using System.Text.Json.Serialization;

namespace ProjectApi.Models;
public class Assignment : ISoftDeletable {
    public int AssignmentId { get; set; }
    public int TaskId { get; set; }
    public int EmployeeId { get; set; }
    public int HoursAllocated { get; set; }
    [JsonIgnore] public bool IsDeleted { get; set; }
    [JsonIgnore] public DateTime? DeletedAt { get; set; }
    [JsonIgnore] public Guid? DeletionGroupId { get; set; }

    public ProjectTask? Task { get; set; }
    public Employee? Employee { get; set; }
}