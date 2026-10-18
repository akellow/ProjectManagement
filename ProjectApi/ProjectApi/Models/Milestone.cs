using System.Text.Json.Serialization;

namespace ProjectApi.Models;
public class Milestone : ISoftDeletable {
    public int MilestoneId { get; set; }
    public int ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }
    public string Status { get; set; } = "Pending";
    [JsonIgnore] public bool IsDeleted { get; set; }
    [JsonIgnore] public DateTime? DeletedAt { get; set; }
    [JsonIgnore] public Guid? DeletionGroupId { get; set; }

    public Project? Project { get; set; }
}