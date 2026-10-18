using System.ComponentModel.DataAnnotations;

namespace ProjectApi.Models;

public class ProjectTaskCreateDto
{
    [Range(1, int.MaxValue)]
    public int ProjectId { get; set; }

    [Required]
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public string Priority { get; set; } = "Normal";

    [Range(1, int.MaxValue)]
    public int EmployeeId { get; set; }

    [Range(1, int.MaxValue)]
    public int HoursAllocated { get; set; }
}
