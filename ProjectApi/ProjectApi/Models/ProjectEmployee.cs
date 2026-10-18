using System.Text.Json.Serialization;

namespace ProjectApi.Models;

public class ProjectEmployee : ISoftDeletable
{
    public int ProjectEmployeeId { get; set; }
    public int ProjectId { get; set; }
    public int EmployeeId { get; set; }
    [JsonIgnore] public bool IsDeleted { get; set; }
    [JsonIgnore] public DateTime? DeletedAt { get; set; }
    [JsonIgnore] public Guid? DeletionGroupId { get; set; }

    public Project? Project { get; set; }
    public Employee? Employee { get; set; }
}
