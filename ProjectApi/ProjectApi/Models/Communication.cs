using System.Text.Json.Serialization;

namespace ProjectApi.Models;
public class Communication : ISoftDeletable {
    public int CommunicationId { get; set;}
    public int ProjectId { get; set; }
    public int EmployeeId { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    [JsonIgnore] public bool IsDeleted { get; set; }
    [JsonIgnore] public DateTime? DeletedAt { get; set; }
    [JsonIgnore] public Guid? DeletionGroupId { get; set; }

    public Project? Project { get; set; }
    public Employee? Employee { get; set; }
    public ICollection<Notification>? Notifications { get; set; }

}