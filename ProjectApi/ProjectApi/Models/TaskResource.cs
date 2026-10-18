using System.Text.Json.Serialization;

namespace ProjectApi.Models;
public class TaskResource : ISoftDeletable {
    public int TaskResourceId { get; set; }
    public int TaskId { get; set; }
    public int ResourceId { get; set; }
    public int Quantity { get; set; }
    [JsonIgnore] public bool IsDeleted { get; set; }
    [JsonIgnore] public DateTime? DeletedAt { get; set; }
    [JsonIgnore] public Guid? DeletionGroupId { get; set; }

    public ProjectTask? Task { get; set; }
    public Resource? Resource { get; set; }
}