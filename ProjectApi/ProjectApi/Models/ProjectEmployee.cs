namespace ProjectApi.Models;

public class ProjectEmployee
{
    public int ProjectEmployeeId { get; set; }
    public int ProjectId { get; set; }
    public int EmployeeId { get; set; }

    public Project? Project { get; set; }
    public Employee? Employee { get; set; }
}
