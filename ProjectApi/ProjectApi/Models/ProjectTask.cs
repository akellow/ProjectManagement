using System.Text.Json.Serialization;

namespace ProjectApi.Models;
public class ProjectTask : ISoftDeletable {
    public int ProjectTaskId { get; set; }
    public int ProjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Priority { get; set; } = "Normal";
    [JsonIgnore] public bool IsDeleted { get; set; }
    [JsonIgnore] public DateTime? DeletedAt { get; set; }
    [JsonIgnore] public Guid? DeletionGroupId { get; set; }

    public Project? Project { get; set; }
    public ICollection<Assignment>? Assignments { get; set; }
    public ICollection<TaskResource>? TaskResources { get; set; }
}