namespace ProjectApi.Models;
public class Communication {
    public int CommunicationId { get; set;}
    public int ProjectId { get; set; }
    public int EmployeeId { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTime Date { get; set; }

    public Project? Project { get; set; }
    public Employee? Employee { get; set; }
    public ICollection<Notification>? Notifications { get; set; }

}