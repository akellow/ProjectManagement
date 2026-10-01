namespace ProjectApi.Models;
public class Employee {
    public int EmployeeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string ContactInfo { get; set; } = string.Empty;
    public string? UserId { get; set; }

    public ICollection<Assignment>? Assignments { get; set; }
    public ICollection<Communication>? Communications { get; set; }
    public ICollection<ProjectEmployee>? Projects { get; set; }
}