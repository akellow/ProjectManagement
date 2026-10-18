using System.Text.Json.Serialization;

namespace ProjectApi.Models;

public class TaskAttachment : ISoftDeletable
{
    public int TaskAttachmentId { get; set; }
    public int TaskId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string StorageName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public long Size { get; set; }
    public string UploadedByUserId { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    [JsonIgnore] public bool IsDeleted { get; set; }
    [JsonIgnore] public DateTime? DeletedAt { get; set; }
    [JsonIgnore] public Guid? DeletionGroupId { get; set; }
}
