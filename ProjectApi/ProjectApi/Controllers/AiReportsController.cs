using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectApi.Services;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/admin/reports")]
[Authorize(Policy = "SuperAdminOnly")]
public sealed class AiReportsController : ControllerBase
{
    private static readonly HashSet<string> SupportedReportTypes =
        new(StringComparer.OrdinalIgnoreCase) { "portfolio", "schedule", "risks", "resources" };

    private readonly AiReportService _reportService;
    private readonly ILogger<AiReportsController> _logger;

    public AiReportsController(AiReportService reportService, ILogger<AiReportsController> logger)
    {
        _reportService = reportService;
        _logger = logger;
    }

    [HttpPost("generate")]
    public async Task<ActionResult<AiReportResponse>> Generate(
        [FromBody] AiReportRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ReportType)
            || !SupportedReportTypes.Contains(request.ReportType))
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Unsupported report type.",
                Detail = "Choose portfolio, schedule, risks, or resources.",
                Status = StatusCodes.Status400BadRequest
            });
        }

        try
        {
            var reportType = request.ReportType.ToLowerInvariant();
            var report = await _reportService.GenerateAsync(
                reportType,
                cancellationToken);
            return Ok(new AiReportResponse(reportType, report));
        }
        catch (InvalidOperationException exception)
        {
            _logger.LogError(exception, "AI report generation is unavailable because configuration or provider output is invalid.");
            return Problem(
                "AI report generation is unavailable. Check the API's OpenAI configuration and try again.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (HttpRequestException exception)
        {
            _logger.LogWarning(exception, "AI report provider request failed.");
            return Problem(
                "The AI report provider could not complete the request. Try again later.",
                statusCode: StatusCodes.Status502BadGateway);
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning(exception, "AI report provider request timed out.");
            return Problem(
                "The AI report provider timed out. Try again later.",
                statusCode: StatusCodes.Status504GatewayTimeout);
        }
    }
}

public sealed record AiReportRequest(string ReportType);

public sealed record AiReportResponse(string ReportType, string Report);
