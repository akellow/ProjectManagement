namespace ProjectApi.Models;
public class ProjectTask {
    public int ProjectTaskId { get; set; }
    public int ProjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Priority { get; set; } = "Normal";

    public Project? Project { get; set; }
    public ICollection<Assignment>? Assignments { get; set; }
    public ICollection<TaskResource>? TaskResources { get; set; }
}