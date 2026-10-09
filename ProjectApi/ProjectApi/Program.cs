using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
using System.IO.Compression;
using Microsoft.AspNetCore.ResponseCompression;
using ProjectApi.Data;
using ProjectApi.Models;
using ProjectApi.GraphQL;
using ProjectApi.Services;
using HotChocolate.Data;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddMemoryCache();
builder.Services.AddHttpClient();
builder.Services.AddScoped<AiReportService>();
builder.Services.AddResponseCompression(options =>
{
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
    options.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
    options.Level = CompressionLevel.Fastest);
builder.Services.AddSingleton<EmailOtpService>();
builder.Services.AddSingleton<OrganizationAdminService>();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend",
        policy => policy.WithOrigins(
                "http://localhost:5173",
                "https://project-management-beta-red.vercel.app"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

builder.Services.AddIdentityCore<ApplicationUser>()
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>();

const string LocalJwtScheme = "LocalJwt";
const string SupabaseJwtScheme = "SupabaseJwt";
const string SmartBearerScheme = "SmartBearer";

var supabaseUrl = builder.Configuration["Supabase:Url"]
    ?? builder.Configuration["SUPABASE_URL"];
var supabaseIssuer = string.IsNullOrWhiteSpace(supabaseUrl)
    ? null
    : $"{supabaseUrl.TrimEnd('/')}/auth/v1";
var supabaseSigningKeys = Array.Empty<SecurityKey>();

if (supabaseIssuer is not null)
{
    using var supabaseHttpClient = new HttpClient();
    var jwksJson = await supabaseHttpClient.GetStringAsync($"{supabaseIssuer}/.well-known/jwks.json");
    supabaseSigningKeys = new JsonWebKeySet(jwksJson).GetSigningKeys().ToArray();
}

var authentication = builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = SmartBearerScheme;
    options.DefaultChallengeScheme = SmartBearerScheme;
})
.AddPolicyScheme(SmartBearerScheme, null, options =>
{
    options.ForwardDefaultSelector = context =>
    {
        var authorization = context.Request.Headers.Authorization.ToString();
        if (!authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return LocalJwtScheme;
        }

        try
        {
            var token = authorization["Bearer ".Length..].Trim();
            var issuer = new JwtSecurityTokenHandler().ReadJwtToken(token).Issuer;
            var scheme = string.Equals(issuer, supabaseIssuer, StringComparison.OrdinalIgnoreCase)
                ? SupabaseJwtScheme
                : LocalJwtScheme;
            if (builder.Environment.IsDevelopment())
            {
                Console.WriteLine($"Bearer token routed to {scheme}.");
            }
            return scheme;
        }
        catch
        {
            return LocalJwtScheme;
        }
    };
})
.AddJwtBearer(LocalJwtScheme, options =>
{
    var jwtIssuer = builder.Configuration["Jwt:Issuer"]
        ?? throw new InvalidOperationException("Jwt:Issuer is not configured.");
    var jwtAudience = builder.Configuration["Jwt:Audience"]
        ?? throw new InvalidOperationException("Jwt:Audience is not configured.");
    var jwtKey = builder.Configuration["Jwt:Key"]
        ?? throw new InvalidOperationException("Jwt:Key is not configured.");

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        NameClaimType = ClaimTypes.NameIdentifier,
        RoleClaimType = ClaimTypes.Role,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtKey)
        )
    };

    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = context =>
        {
            var metadata = context.Principal?.FindFirst("app_metadata")?.Value;
            if (!string.IsNullOrWhiteSpace(metadata))
            {
                using var document = JsonDocument.Parse(metadata);
                if (document.RootElement.TryGetProperty("role", out var roleClaim)
                    && roleClaim.ValueKind == JsonValueKind.String)
                {
                    AddTrustedAdminRole(context.Principal, roleClaim.GetString());
                }
            }

            AddTrustedAdminRole(
                context.Principal,
                context.Principal?.FindFirst(ClaimTypes.Role)?.Value);

            return Task.CompletedTask;
        }
    };
});

if (supabaseIssuer is not null)
{
    authentication.AddJwtBearer(SupabaseJwtScheme, options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = supabaseIssuer,
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKeyResolver = (_, _, keyId, _) =>
                supabaseSigningKeys.Where(key => string.Equals(key.KeyId, keyId, StringComparison.Ordinal)),
            NameClaimType = "sub",
            RoleClaimType = ClaimTypes.Role
        };
        options.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                if (builder.Environment.IsDevelopment())
                {
                    Console.WriteLine($"Supabase JWT validation failed: {context.Exception.GetType().Name}: {context.Exception.Message}");
                }
                return Task.CompletedTask;
            },
            OnTokenValidated = context =>
            {
                var metadata = context.Principal?.FindFirst("app_metadata")?.Value;
                if (!string.IsNullOrWhiteSpace(metadata))
                {
                    using var document = JsonDocument.Parse(metadata);
                    if (document.RootElement.TryGetProperty("role", out var roleClaim)
                        && roleClaim.ValueKind == JsonValueKind.String)
                    {
                        AddTrustedAdminRole(context.Principal, roleClaim.GetString());
                        Console.WriteLine($"✅ Injected app_metadata role: {roleClaim.GetString()}");
                    }
                }

                return Task.CompletedTask;
            }
        };
    });
}
else
{
    Console.WriteLine("Supabase JWT validation is disabled. Configure Supabase:Url or SUPABASE_URL to enable it.");
}

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
        {
            var role = context.User.FindFirstValue("trusted_admin_role");
            return !string.IsNullOrWhiteSpace(role)
                && (role.Equals("admin", StringComparison.OrdinalIgnoreCase)
                    || role.Equals("superadmin", StringComparison.OrdinalIgnoreCase));
        });
    });
    options.AddPolicy("SuperAdminOnly", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireAssertion(context =>
            string.Equals(
                context.User.FindFirstValue("trusted_admin_role"),
                "superadmin",
                StringComparison.OrdinalIgnoreCase));
    });
});

builder.Services
    .AddGraphQLServer()
    .AddQueryType<Query>()
    .AddMutationType<Mutation>()
    .AddFiltering()
    .AddSorting()
    .AddProjections();

var app = builder.Build();

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Urls.Clear();
app.Urls.Add($"http://*:{port}");

app.UseResponseCompression();

using (var migrationScope = app.Services.CreateScope())
{
    var database = migrationScope.ServiceProvider.GetRequiredService<AppDbContext>();
    await database.Database.MigrateAsync();
}
await SeedIdentityAsync(app.Services, app.Configuration);

app.UseCors("AllowFrontend");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Urls.Any(url => url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
{
    app.UseHttpsRedirection();
}
else
{
    Console.WriteLine("HTTPS redirection skipped because no HTTPS URL is configured for this runtime.");
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGraphQL();
app.Run();

static void AddTrustedAdminRole(ClaimsPrincipal? principal, string? role)
{
    if (principal?.Identity is not ClaimsIdentity identity
        || string.IsNullOrWhiteSpace(role)
        || (!role.Equals("admin", StringComparison.OrdinalIgnoreCase)
            && !role.Equals("superadmin", StringComparison.OrdinalIgnoreCase)))
    {
        return;
    }

    if (!identity.HasClaim("trusted_admin_role", role))
    {
        identity.AddClaim(new Claim("trusted_admin_role", role));
    }
    if (!identity.HasClaim(ClaimTypes.Role, role))
    {
        identity.AddClaim(new Claim(ClaimTypes.Role, role));
    }
}

static async Task SeedIdentityAsync(IServiceProvider services, IConfiguration configuration)
{
    using var scope = services.CreateScope();
    var serviceProvider = scope.ServiceProvider;
    var roleManager = serviceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var userManager = serviceProvider.GetRequiredService<UserManager<ApplicationUser>>();

    var username = configuration["Jwt:SuperAdminUsername"];
    var email = configuration["Jwt:SuperAdminEmail"];
    var password = configuration["Jwt:SuperAdminPassword"];

    if ((!string.IsNullOrWhiteSpace(email) || !string.IsNullOrWhiteSpace(password))
        && (string.IsNullOrWhiteSpace(username)
            || string.IsNullOrWhiteSpace(email)
            || string.IsNullOrWhiteSpace(password)))
    {
        throw new InvalidOperationException(
            "Jwt:SuperAdminUsername, Jwt:SuperAdminEmail, and Jwt:SuperAdminPassword must all be configured to seed the superadmin user.");
    }

    foreach (var role in new[] { "user", "admin", "superadmin" })
    {
        if (await roleManager.RoleExistsAsync(role))
        {
            continue;
        }

        var result = await roleManager.CreateAsync(new IdentityRole(role));
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Unable to create the '{role}' role: {string.Join("; ", result.Errors.Select(error => error.Description))}");
        }
    }

    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
    {
        return;
    }

    if (string.IsNullOrWhiteSpace(username))
    {
        throw new InvalidOperationException(
            "Jwt:SuperAdminUsername must be configured to seed the superadmin user.");
    }

    var user = await userManager.FindByNameAsync(username);
    if (user is null)
    {
        user = new ApplicationUser
        {
            UserName = username,
            Email = email,
            EmailConfirmed = false
        };

        var createResult = await userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            throw new InvalidOperationException(
                $"Unable to create the configured superadmin user: {string.Join("; ", createResult.Errors.Select(error => error.Description))}");
        }
    }

    if (!await userManager.IsInRoleAsync(user, "superadmin"))
    {
        var roleResult = await userManager.AddToRoleAsync(user, "superadmin");
        if (!roleResult.Succeeded)
        {
            throw new InvalidOperationException(
                $"Unable to assign the superadmin role: {string.Join("; ", roleResult.Errors.Select(error => error.Description))}");
        }
    }

    var dbContext = serviceProvider.GetRequiredService<AppDbContext>();
    if (!await dbContext.Employees.AnyAsync(employee => employee.UserId == user.Id))
    {
        dbContext.Employees.Add(new Employee
        {
            Name = user.UserName ?? username,
            Role = "superadmin",
            ContactInfo = user.Email ?? email,
            UserId = user.Id
        });
        await dbContext.SaveChangesAsync();
    }
}
