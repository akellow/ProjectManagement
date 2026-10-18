using System.Text.Json.Serialization;

namespace ProjectApi.Models;
public class Project : ISoftDeletable {
    public int ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public decimal Budget { get; set; }
    public string Status { get; set; } = "Pending";
    [JsonIgnore] public bool IsDeleted { get; set; }
    [JsonIgnore] public DateTime? DeletedAt { get; set; }
    [JsonIgnore] public Guid? DeletionGroupId { get; set; }

    public ICollection<ProjectTask>? Tasks { get; set; }
    public ICollection<Milestone>? Milestones { get; set;}
    public ICollection<Risk>? Risks { get; set; }
    public ICollection<Communication>? Communications { get; set; }
    public ICollection<ProjectEmployee>? Employees { get; set; }
}