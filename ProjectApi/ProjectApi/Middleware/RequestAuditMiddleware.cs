using System.Security.Claims;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Middleware;

public sealed class RequestAuditMiddleware : IMiddleware
{
    private readonly AppDbContext _context;
    private readonly ILogger<RequestAuditMiddleware> _logger;

    public RequestAuditMiddleware(AppDbContext context, ILogger<RequestAuditMiddleware> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, RequestDelegate next)
    {
        var path = context.Request.Path.Value ?? "/";
        if (!path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase)
            || path.Equals("/api/admin/audit", StringComparison.OrdinalIgnoreCase))
        {
            await next(context);
            return;
        }

        try
        {
            await next(context);
        }
        catch
        {
            if (!context.Response.HasStarted)
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            throw;
        }
        finally
        {
            var statusCode = context.Response.StatusCode;
            var endpoint = $"{context.Request.Method.ToUpperInvariant()} {NormalizePath(path)}";
            var actor = context.User.FindFirstValue(ClaimTypes.Name)
                ?? context.User.FindFirstValue("email")
                ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? "anonymous";

            _context.AuditLogs.Add(new AuditLog
            {
                Timestamp = DateTimeOffset.UtcNow,
                Actor = actor,
                Action = "request completed",
                Target = endpoint,
                Endpoint = NormalizePath(path),
                Severity = statusCode >= 500 ? "error" : statusCode >= 400 ? "warning" : "info",
                StatusCode = statusCode
            });

            try
            {
                await _context.SaveChangesAsync(CancellationToken.None);
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Failed to persist API request audit event for {Endpoint}.", endpoint);
            }
        }
    }

    private static string NormalizePath(string path)
    {
        var segments = path.Split('/');
        for (var index = 1; index < segments.Length; index++)
        {
            var segment = segments[index];
            if (Guid.TryParse(segment, out _) || long.TryParse(segment, out _))
            {
                segments[index] = "{id}";
            }
        }

        return string.Join('/', segments);
    }
}
