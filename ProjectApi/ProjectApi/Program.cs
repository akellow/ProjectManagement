using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;
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
builder.Services.AddSingleton<EmailOtpService>();
builder.Services.AddSingleton<OrganizationAdminService>();

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
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
        OnAuthenticationFailed = context =>
        {
            if (builder.Environment.IsDevelopment())
            {
                Console.WriteLine($"Local JWT validation failed: {context.Exception.GetType().Name}: {context.Exception.Message}");
            }
            return Task.CompletedTask;
        },
        OnTokenValidated = context =>
        {
            var role = context.Principal?.FindFirst("role")?.Value
                ?? context.Principal?.FindFirst(ClaimTypes.Role)?.Value;
            AddTrustedAdminRole(context.Principal, role);
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

using (var migrationScope = app.Services.CreateScope())
{
    var database = migrationScope.ServiceProvider.GetRequiredService<AppDbContext>();
    await database.Database.MigrateAsync();
}
await SeedIdentityAsync(app.Services, app.Configuration);  
app.UseCors("AllowFrontend");

// Configure the HTTP request pipeline.
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

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weatherforecast", () =>
{
    var forecast =  Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
})
.WithName("GetWeatherForecast")
.WithOpenApi();


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

    identity.AddClaim(new Claim("trusted_admin_role", role));
    if (!identity.HasClaim(ClaimTypes.Role, role))
    {
        identity.AddClaim(new Claim(ClaimTypes.Role, role));
    }
}

static async Task SeedIdentityAsync(IServiceProvider services, IConfiguration configuration)
{
    using var scope = services.CreateScope();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Roles to seed
    var roles = new[] { "superadmin", "admin", "user" };
    foreach (var role in roles)
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            await roleManager.CreateAsync(new IdentityRole(role));
            Console.WriteLine($"✅ Created role: {role}");
        }
    }

    // Superadmin user
    var superAdminEmail = configuration["Jwt:SuperAdminEmail"] ?? "darksister647@gmail.com";
    var superAdminPassword = configuration["Jwt:SuperAdminPassword"] ?? "StrongPassword123!";
    var superAdminUser = await userManager.FindByEmailAsync(superAdminEmail);

    if (superAdminUser == null)
    {
        superAdminUser = new ApplicationUser
        {
            UserName = "superadmin",
            Email = superAdminEmail,
            EmailConfirmed = true
        };
        var result = await userManager.CreateAsync(superAdminUser, superAdminPassword);
        if (!result.Succeeded) throw new InvalidOperationException(string.Join("; ", result.Errors.Select(e => e.Description)));
        Console.WriteLine($"✅ Created superadmin user: {superAdminEmail}");
    }

    if (!await userManager.IsInRoleAsync(superAdminUser, "superadmin"))
    {
        await userManager.AddToRoleAsync(superAdminUser, "superadmin");
        Console.WriteLine($"✅ Assigned superadmin role to {superAdminEmail}");
    }

    // Admin user (example)
    var adminEmail = "admin@projectapp.local";
    var adminPassword = "AdminPassword123!";
    var adminUser = await userManager.FindByEmailAsync(adminEmail);

    if (adminUser == null)
    {
        adminUser = new ApplicationUser
        {
            UserName = "admin",
            Email = adminEmail,
            EmailConfirmed = true
        };
        await userManager.CreateAsync(adminUser, adminPassword);
        await userManager.AddToRoleAsync(adminUser, "admin");
        Console.WriteLine($"✅ Created admin user: {adminEmail}");
    }

    // Employees table sync
    foreach (var applicationUser in userManager.Users.ToList())
    {
        if (!context.Employees.Any(e => e.UserId == applicationUser.Id))
        {
            var rolesForUser = await userManager.GetRolesAsync(applicationUser);
            context.Employees.Add(new Employee
            {
                Name = applicationUser.UserName ?? applicationUser.Id,
                Role = rolesForUser.FirstOrDefault() ?? "User",
                ContactInfo = applicationUser.Email ?? string.Empty,
                Department = "General",
                UserId = applicationUser.Id
            });
            Console.WriteLine($"✅ Synced employee record for {applicationUser.Email}");
        }
    }
    await context.SaveChangesAsync();

    // Supabase update for superadmin
    var supabaseUrl = configuration["SUPABASE_URL"];
    var serviceRoleKey = configuration["SUPABASE_SERVICE_ROLE_KEY"];
    var supabaseUserId = configuration["SUPABASE_SUPERADMIN_ID"]; // UUID from JWT "sub"

    if (!string.IsNullOrWhiteSpace(supabaseUrl) &&
        !string.IsNullOrWhiteSpace(serviceRoleKey) &&
        !string.IsNullOrWhiteSpace(supabaseUserId))
    {
        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("apikey", serviceRoleKey);
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {serviceRoleKey}");

        var payload = new
        {
            app_metadata = new { role = "superadmin" },
            user_metadata = new { role = "superadmin" }
        };

        var response = await client.PutAsJsonAsync($"{supabaseUrl}/auth/v1/admin/users/{supabaseUserId}", payload);

        if (response.IsSuccessStatusCode)
        {
            Console.WriteLine($"✅ Updated {superAdminEmail} to superadmin in Supabase Auth.");
        }
        else
        {
            var error = await response.Content.ReadAsStringAsync();
            Console.WriteLine($"❌ Supabase superadmin update failed: {error}");
        }
    }
}


record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
