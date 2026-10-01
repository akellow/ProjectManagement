using Microsoft.AspNetCore.Mvc;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LocalController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;

    public LocalController(IConfiguration configuration, IWebHostEnvironment environment)
    {
        _configuration = configuration;
        _environment = environment;
    }

    [HttpGet("service-status")]
    public IActionResult ServiceStatus()
    {
        if (!_environment.IsDevelopment())
        {
            return NotFound(new { message = "This endpoint is only enabled in the local development environment." });
        }

        var configuredKey = GetConfiguredServiceKey();
        if (string.IsNullOrWhiteSpace(configuredKey))
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                message = "No local service key is configured. Set ServiceKey or SERVICE_KEY before running the local endpoint."
            });
        }

        var providedKey = GetProvidedServiceKey();
        if (!string.Equals(providedKey, configuredKey, StringComparison.Ordinal))
        {
            return Unauthorized(new
            {
                message = "Invalid service key. Send the configured local service key in the X-Service-Key header or as the serviceKey query parameter."
            });
        }

        return Ok(new
        {
            ok = true,
            environment = _environment.EnvironmentName,
            message = "Local backend service is running with the configured service key.",
            timestamp = DateTimeOffset.UtcNow
        });
    }

    private string? GetProvidedServiceKey()
    {
        if (Request.Headers.TryGetValue("X-Service-Key", out var headerValue) && !string.IsNullOrWhiteSpace(headerValue))
        {
            return headerValue.ToString();
        }

        var authHeader = Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return authHeader["Bearer ".Length..].Trim();
        }

        return Request.Query["serviceKey"].FirstOrDefault();
    }

    private string? GetConfiguredServiceKey()
    {
        return _configuration["ServiceKey"]
            ?? _configuration["App:ServiceKey"]
            ?? _configuration["LocalServiceKey"]
            ?? Environment.GetEnvironmentVariable("SERVICE_KEY")
            ?? Environment.GetEnvironmentVariable("LOCAL_SERVICE_KEY");
    }
}
