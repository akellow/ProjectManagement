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

    public async Task<OrganizationInvitation> InviteAsync(string email, string role, string invitedBy)
    {
        var supabaseUrl = (_configuration["Supabase:Url"] ?? _configuration["SUPABASE_URL"])?.TrimEnd('/');
        var serviceRoleKey = _configuration["SUPABASE_SERVICE_ROLE_KEY"] ?? _configuration["Supabase:ServiceRoleKey"];
        if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(serviceRoleKey))
        {
            throw new InvalidOperationException("Supabase invitations are not configured on the API. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.");
        }

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

        return "Supabase Auth rejected the invitation request.";
    }

    public IReadOnlyCollection<OrganizationInvitation> GetInvitations() => _invitations.ToArray();
    public IReadOnlyCollection<AuditEntry> GetAuditEntries() => _auditEntries.ToArray().OrderByDescending(item => item.Timestamp).ToArray();

    public void AddAudit(string actor, string action, string target) => _auditEntries.Enqueue(new AuditEntry(DateTimeOffset.UtcNow, actor, action, target));
}

public sealed record OrganizationInvitation(Guid Id, string Email, string Role, string InvitedBy, DateTimeOffset ExpiresAt);
public sealed record AuditEntry(DateTimeOffset Timestamp, string Actor, string Action, string Target);
