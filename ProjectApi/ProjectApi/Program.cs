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
    policy => policy.WithOrigins("http://localhost:5173")
                     .AllowAnyHeader()
                     .AllowAnyMethod());
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
using (var migrationScope = app.Services.CreateScope())
{
    var database = migrationScope.ServiceProvider.GetRequiredService<AppDbContext>();
    await database.Database.MigrateAsync();
}
await SeedSuperAdminAsync(app.Services, app.Configuration);
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

static async Task SeedSuperAdminAsync(IServiceProvider services, IConfiguration configuration)
{
    using var scope = services.CreateScope();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var username = configuration["Jwt:SuperAdminUsername"] ?? "superadmin";
    var password = configuration["Jwt:SuperAdminPassword"];
    var email = configuration["Jwt:SuperAdminEmail"] ?? "superadmin@projectapp.local";
    const string roleName = "superadmin";

    if (string.IsNullOrWhiteSpace(password))
    {
        Console.WriteLine("Super admin seeding skipped because Jwt:SuperAdminPassword is not configured.");
        return;
    }

    Console.WriteLine($"Starting superadmin seed: username={username}, email={email}, role={roleName}");

    if (!await roleManager.RoleExistsAsync(roleName))
    {
        var result = await roleManager.CreateAsync(new IdentityRole(roleName));
        if (!result.Succeeded) throw new InvalidOperationException(string.Join("; ", result.Errors.Select(error => error.Description)));
        Console.WriteLine($"Created role: {roleName}");
    }

    var user = await userManager.FindByNameAsync(username);
    if (user is null)
    {
        user = new ApplicationUser { UserName = username, Email = email, EmailConfirmed = true };
        var result = await userManager.CreateAsync(user, password);
        if (!result.Succeeded) throw new InvalidOperationException(string.Join("; ", result.Errors.Select(error => error.Description)));
        Console.WriteLine($"Created superadmin user: {username}");
    }
    else
    {
        Console.WriteLine($"Superadmin user already exists: {user.UserName}");
        if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
        {
            user.Email = email;
            await userManager.UpdateAsync(user);
        }

        user.EmailConfirmed = true;
        await userManager.UpdateAsync(user);

        if (!await userManager.CheckPasswordAsync(user, password))
        {
            var removePasswordResult = await userManager.RemovePasswordAsync(user);
            if (!removePasswordResult.Succeeded)
            {
                throw new InvalidOperationException(string.Join("; ", removePasswordResult.Errors.Select(error => error.Description)));
            }

            var addPasswordResult = await userManager.AddPasswordAsync(user, password);
            if (!addPasswordResult.Succeeded)
            {
                throw new InvalidOperationException(string.Join("; ", addPasswordResult.Errors.Select(error => error.Description)));
            }

            Console.WriteLine($"Reset password for superadmin user: {username}");
        }
    }

    if (!await userManager.IsInRoleAsync(user, roleName))
    {
        var result = await userManager.AddToRoleAsync(user, roleName);
        if (!result.Succeeded) throw new InvalidOperationException(string.Join("; ", result.Errors.Select(error => error.Description)));
        Console.WriteLine($"Assigned role {roleName} to {user.UserName}");
    }

    foreach (var applicationUser in userManager.Users.ToList())
    {
        if (!context.Employees.Any(employee => employee.UserId == applicationUser.Id))
        {
            var roles = await userManager.GetRolesAsync(applicationUser);
            context.Employees.Add(new Employee { Name = applicationUser.UserName ?? applicationUser.Id, Role = roles.FirstOrDefault() ?? "User", ContactInfo = applicationUser.Email ?? string.Empty, UserId = applicationUser.Id });
        }
    }
    await context.SaveChangesAsync();
}

record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
