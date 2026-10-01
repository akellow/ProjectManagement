namespace ProjectApi.Models;
public class Milestone {
    public int MilestoneId { get; set; }
    public int ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime DueDate { get; set; }
    public string Status { get; set; } = "Pending";

    public Project? Project { get; set; }
}