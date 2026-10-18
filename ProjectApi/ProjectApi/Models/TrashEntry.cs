namespace ProjectApi.Models;

public class TrashEntry
{
    public int TrashEntryId { get; set; }
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public Guid DeletionGroupId { get; set; }
    public DateTime DeletedAt { get; set; }
}
