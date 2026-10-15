namespace ProjectApi.Models;

public class AuditLog
{
    public long AuditLogId { get; set; }
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    public string Actor { get; set; } = "system";
    public string Action { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
    public string Severity { get; set; } = "info";
    public int? StatusCode { get; set; }
    public string? Endpoint { get; set; }
}
