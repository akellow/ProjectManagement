namespace ProjectApi.Models;
public class Resource {
    public int ResourceId { get; set; }
    public int ProjectId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public decimal Cost { get; set; }
    public bool Availability { get; set; }

    public ICollection<TaskResource>? TaskResources { get; set; }
    public Project? Project { get; set; }
}