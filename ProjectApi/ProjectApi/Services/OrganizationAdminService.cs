using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace ProjectApi.Services;

public sealed class OrganizationAdminService
{
    private readonly ConcurrentBag<OrganizationInvitation> _invitations = new();
    private readonly ConcurrentQueue<AuditEntry> _auditEntries = new();
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;

    public OrganizationAdminService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
    }

    public async Task<IReadOnlyList<OrganizationUser>> GetSupabaseUsersAsync()
    {
        var (supabaseUrl, serviceRoleKey) = GetSupabaseAdminConfiguration();
        var client = _httpClientFactory.CreateClient();
        var users = new List<OrganizationUser>();

        for (var page = 1; ; page++)
        {
            using var request = CreateAdminRequest(
                HttpMethod.Get,
                $"{supabaseUrl}/auth/v1/admin/users?page={page}&per_page=100",
                serviceRoleKey);
            using var response = await client.SendAsync(request);
            var body = await response.Content.ReadAsStringAsync();
            EnsureSuccess(response, body);

            using var document = JsonDocument.Parse(body);
            if (!document.RootElement.TryGetProperty("users", out var usersElement)
                || usersElement.ValueKind != JsonValueKind.Array)
            {
                throw new InvalidOperationException("Supabase returned an unexpected user list response.");
            }

            foreach (var user in usersElement.EnumerateArray())
            {
                var id = GetString(user, "id");
                if (string.IsNullOrWhiteSpace(id))
                {
                    continue;
                }

                var email = GetString(user, "email") ?? string.Empty;
                var metadata = user.TryGetProperty("user_metadata", out var userMetadata)
                    ? userMetadata
                    : default;
                var userName = GetString(metadata, "full_name")
                    ?? GetString(metadata, "name")
                    ?? email;
                var role = user.TryGetProperty("app_metadata", out var appMetadata)
                    ? GetString(appMetadata, "role")
                    : null;

                users.Add(new OrganizationUser(
                    id,
                    userName,
                    email,
                    [IsAllowedRole(role) ? role!.ToLowerInvariant() : "user"],
                    "supabase"));
            }

            if (usersElement.GetArrayLength() < 100)
            {
                break;
            }
        }

        return users;
    }

    public async Task UpdateSupabaseUserRoleAsync(
        string userId,
        string role,
        string actor,
        bool canManagePrivilegedUsers)
    {
        var (supabaseUrl, serviceRoleKey) = GetSupabaseAdminConfiguration();
        var client = _httpClientFactory.CreateClient();
        var user = await GetSupabaseUserAsync(client, supabaseUrl, serviceRoleKey, userId);
        var appMetadata = GetMetadata(user, "app_metadata");
        var currentRole = GetString(
            user.TryGetProperty("app_metadata", out var existingMetadata) ? existingMetadata : default,
            "role");
        if (IsPrivilegedRole(currentRole) && !canManagePrivilegedUsers)
        {
            throw new UnauthorizedAccessException("Only a superadmin can change another privileged account.");
        }

        appMetadata["role"] = JsonSerializer.SerializeToElement(role.ToLowerInvariant());

        using var request = CreateAdminRequest(
            HttpMethod.Put,
            $"{supabaseUrl}/auth/v1/admin/users/{Uri.EscapeDataString(userId)}",
            serviceRoleKey);
        request.Content = JsonContent.Create(new { app_metadata = appMetadata });
        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        EnsureSuccess(response, body);
        AddAudit(actor, "user.role.updated", GetString(user, "email") ?? userId);
    }

    public async Task DeleteSupabaseUserAsync(string userId, string actor, bool canManagePrivilegedUsers)
    {
        var (supabaseUrl, serviceRoleKey) = GetSupabaseAdminConfiguration();
        var client = _httpClientFactory.CreateClient();
        var user = await GetSupabaseUserAsync(client, supabaseUrl, serviceRoleKey, userId);
        var currentRole = GetString(
            user.TryGetProperty("app_metadata", out var appMetadata) ? appMetadata : default,
            "role");
        if (IsPrivilegedRole(currentRole) && !canManagePrivilegedUsers)
        {
            throw new UnauthorizedAccessException("Only a superadmin can delete another privileged account.");
        }

        using var request = CreateAdminRequest(
            HttpMethod.Delete,
            $"{supabaseUrl}/auth/v1/admin/users/{Uri.EscapeDataString(userId)}",
            serviceRoleKey);
        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        EnsureSuccess(response, body);
        AddAudit(actor, "user.deleted", userId);
    }

    public async Task<OrganizationInvitation> InviteAsync(string email, string role, string invitedBy)
    {
        var (supabaseUrl, serviceRoleKey) = GetSupabaseAdminConfiguration();

        var redirectUrl = _configuration["SUPABASE_AUTH_REDIRECT_URL"]
            ?? _configuration["Supabase:InviteRedirectUrl"]
            ?? "http://localhost:5173/login";
        var client = _httpClientFactory.CreateClient();
        using var inviteRequest = CreateAdminRequest(
            HttpMethod.Post,
            $"{supabaseUrl}/auth/v1/invite?redirect_to={Uri.EscapeDataString(redirectUrl)}",
            serviceRoleKey);
        inviteRequest.Content = JsonContent.Create(new { email = email.Trim() });

        using var inviteResponse = await client.SendAsync(inviteRequest);
        var inviteBody = await inviteResponse.Content.ReadAsStringAsync();
        if (!inviteResponse.IsSuccessStatusCode)
        {
            throw new HttpRequestException(GetErrorMessage(inviteBody), null, inviteResponse.StatusCode);
        }

        using var inviteDocument = JsonDocument.Parse(inviteBody);
        var invitedUser = inviteDocument.RootElement.TryGetProperty("user", out var nestedUser)
            ? nestedUser
            : inviteDocument.RootElement;
        if (!invitedUser.TryGetProperty("id", out var userIdElement)
            || string.IsNullOrWhiteSpace(userIdElement.GetString()))
        {
            throw new InvalidOperationException("Supabase created the invitation but returned no user ID.");
        }

        var userId = userIdElement.GetString()!;
        var appMetadata = new Dictionary<string, JsonElement>();
        if (invitedUser.TryGetProperty("app_metadata", out var existingMetadata)
            && existingMetadata.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in existingMetadata.EnumerateObject())
            {
                appMetadata[property.Name] = property.Value.Clone();
            }
        }

        using var roleRequest = CreateAdminRequest(
            HttpMethod.Put,
            $"{supabaseUrl}/auth/v1/admin/users/{Uri.EscapeDataString(userId)}",
            serviceRoleKey);
        roleRequest.Content = JsonContent.Create(new
        {
            app_metadata = appMetadata.ToDictionary(
                property => property.Key,
                property => (object?)property.Value)
                .Append(new KeyValuePair<string, object?>("role", role))
                .GroupBy(property => property.Key)
                .ToDictionary(group => group.Key, group => group.Last().Value)
        });

        using var roleResponse = await client.SendAsync(roleRequest);
        if (!roleResponse.IsSuccessStatusCode)
        {
            var roleBody = await roleResponse.Content.ReadAsStringAsync();
            throw new HttpRequestException($"Invitation was created, but its role could not be assigned. {GetErrorMessage(roleBody)}", null, roleResponse.StatusCode);
        }

        var invitation = new OrganizationInvitation(Guid.NewGuid(), email, role, invitedBy, DateTimeOffset.UtcNow.AddDays(7));
        _invitations.Add(invitation);
        AddAudit(invitedBy, "invitation.created", email);
        return invitation;
    }

    private static HttpRequestMessage CreateAdminRequest(HttpMethod method, string url, string serviceRoleKey)
    {
        var request = new HttpRequestMessage(method, url);
        request.Headers.TryAddWithoutValidation("apikey", serviceRoleKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", serviceRoleKey);
        return request;
    }

    private async Task<JsonElement> GetSupabaseUserAsync(
        HttpClient client,
        string supabaseUrl,
        string serviceRoleKey,
        string userId)
    {
        using var request = CreateAdminRequest(
            HttpMethod.Get,
            $"{supabaseUrl}/auth/v1/admin/users/{Uri.EscapeDataString(userId)}",
            serviceRoleKey);
        using var response = await client.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        EnsureSuccess(response, body);

        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;
        return root.TryGetProperty("user", out var user) ? user.Clone() : root.Clone();
    }

    private (string SupabaseUrl, string ServiceRoleKey) GetSupabaseAdminConfiguration()
    {
        var supabaseUrl = (_configuration["Supabase:Url"] ?? _configuration["SUPABASE_URL"])?.TrimEnd('/');
        var serviceRoleKey = _configuration["SUPABASE_SERVICE_ROLE_KEY"] ?? _configuration["Supabase:ServiceRoleKey"];
        if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(serviceRoleKey))
        {
            throw new InvalidOperationException(
                "Supabase user administration is not configured on the API. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.");
        }

        return (supabaseUrl, serviceRoleKey);
    }

    private static Dictionary<string, JsonElement> GetMetadata(JsonElement user, string name)
    {
        var metadata = new Dictionary<string, JsonElement>();
        if (user.TryGetProperty(name, out var properties)
            && properties.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in properties.EnumerateObject())
            {
                metadata[property.Name] = property.Value.Clone();
            }
        }

        return metadata;
    }

    private static string? GetString(JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object
            && element.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
                ? property.GetString()
                : null;

    private static bool IsAllowedRole(string? role) =>
        string.Equals(role, "user", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "superadmin", StringComparison.OrdinalIgnoreCase);

    private static bool IsPrivilegedRole(string? role) =>
        string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase)
        || string.Equals(role, "superadmin", StringComparison.OrdinalIgnoreCase);

    private static void EnsureSuccess(HttpResponseMessage response, string body)
    {
        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(GetErrorMessage(body), null, response.StatusCode);
        }
    }

    private static string GetErrorMessage(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            foreach (var propertyName in new[] { "msg", "message", "error_description", "error" })
            {
                if (document.RootElement.TryGetProperty(propertyName, out var message)
                    && message.ValueKind == JsonValueKind.String)
                {
                    return message.GetString()!;
                }
            }
        }
        catch (JsonException)
        {
        }

        return "Supabase Auth rejected the admin request.";
    }

    public IReadOnlyCollection<OrganizationInvitation> GetInvitations() => _invitations.ToArray();
    public IReadOnlyCollection<AuditEntry> GetAuditEntries() => _auditEntries.ToArray().OrderByDescending(item => item.Timestamp).ToArray();

    public void AddAudit(string actor, string action, string target) => _auditEntries.Enqueue(new AuditEntry(DateTimeOffset.UtcNow, actor, action, target));
}

public sealed record OrganizationUser(string Id, string UserName, string Email, IReadOnlyList<string> Roles, string Source);
public sealed record OrganizationInvitation(Guid Id, string Email, string Role, string InvitedBy, DateTimeOffset ExpiresAt);
public sealed record AuditEntry(DateTimeOffset Timestamp, string Actor, string Action, string Target);
