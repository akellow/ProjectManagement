namespace ProjectApi.Models;
public class Assignment {
    public int AssignmentId { get; set; }
    public int TaskId { get; set; }
    public int EmployeeId { get; set; }
    public int HoursAllocated { get; set; }

    public ProjectTask? Task { get; set; }
    public Employee? Employee { get; set; }
}