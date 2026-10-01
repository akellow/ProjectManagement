namespace ProjectApi.Models;
public class Risk {
    public int RiskId { get; set; }
    public int ProjectId { get; set; }
    public string Description { get; set; } = string.Empty;
    public double Probability { get; set; }
    public string Impact { get; set; } = string.Empty;
    public string? MitigationPlan { get; set; }

    public Project? Project { get; set; }
}