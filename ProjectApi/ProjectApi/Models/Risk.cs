using System.Text.Json.Serialization;

namespace ProjectApi.Models;
public class Risk : ISoftDeletable {
    public int RiskId { get; set; }
    public int ProjectId { get; set; }
    public string Description { get; set; } = string.Empty;
    public double Probability { get; set; }
    public string Impact { get; set; } = string.Empty;
    public string? MitigationPlan { get; set; }
    [JsonIgnore] public bool IsDeleted { get; set; }
    [JsonIgnore] public DateTime? DeletedAt { get; set; }
    [JsonIgnore] public Guid? DeletionGroupId { get; set; }

    public Project? Project { get; set; }
}