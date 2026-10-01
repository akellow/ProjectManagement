namespace ProjectApi.Models;

public class Notification
{
    public int NotificationId { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public int? CommunicationId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsRead { get; set; }

    public ApplicationUser? User { get; set; }
    public Communication? Communication { get; set; }
}
