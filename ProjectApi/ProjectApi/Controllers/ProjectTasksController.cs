using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;
using ProjectApi.Services;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProjectTasksController : ControllerBase {
    private readonly AppDbContext _context;
    private readonly TrashService _trashService;
    public ProjectTasksController(AppDbContext context, TrashService trashService) { _context = context; _trashService = trashService; }

    [HttpGet] public IEnumerable<ProjectTask> Get() => _context.ProjectTasks.ToList();
    [HttpGet("{id}")] public ActionResult<ProjectTask> GetById(int id)
    {
        var task = _context.ProjectTasks.Find(id);
        if (task == null)
        {
            return NotFound();
        }
        return task;
    }
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ProjectTask>> CreateTask(ProjectTaskCreateDto dto)
    {
        var employee = await _context.Employees.FindAsync(dto.EmployeeId);
        if (employee is null)
            return BadRequest("A valid employee must be assigned to the task.");
        if (!await _context.Projects.AnyAsync(project => project.ProjectId == dto.ProjectId))
            return BadRequest("A valid project is required.");

        var task = new ProjectTask
        {
            ProjectId = dto.ProjectId,
            Title = dto.Title,
            Description = dto.Description,
            Status = dto.Status,
            StartDate = NormalizeUtc(dto.StartDate),
            EndDate = NormalizeUtc(dto.EndDate),
            Priority = dto.Priority,
            Assignments =
            [
                new Assignment
                {
                    EmployeeId = employee.EmployeeId,
                    HoursAllocated = dto.HoursAllocated
                }
            ]
        };
        _context.ProjectTasks.Add(task);
        AddAssignmentNotification(employee, task);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = task.ProjectTaskId }, task);
    }
    [HttpPut("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> PutProjectTask(int id, ProjectTaskUpdateDto dto)
    {
        var task = await _context.ProjectTasks.FindAsync(id);
        if (task == null) return NotFound();
        var assignments = await _context.Assignments.Where(assignment => assignment.TaskId == id).ToListAsync();
        if (dto.EmployeeId.HasValue)
        {
            var employee = await _context.Employees.FindAsync(dto.EmployeeId.Value);
            if (employee is null)
                return BadRequest("A valid employee must be assigned to the task.");
            if (!dto.HoursAllocated.HasValue || dto.HoursAllocated.Value < 1)
                return BadRequest("The assigned period must be at least one hour.");

            var assignment = assignments.FirstOrDefault(item => item.EmployeeId == employee.EmployeeId);
            if (assignment is null)
            {
                assignment = new Assignment { TaskId = id, EmployeeId = employee.EmployeeId };
                _context.Assignments.Add(assignment);
                AddAssignmentNotification(employee, task);
            }
            assignment.HoursAllocated = dto.HoursAllocated.Value;
        }
        else if (assignments.Count == 0)
        {
            return BadRequest("A task must have at least one assigned employee.");
        }

        if (dto.Title is not null) task.Title = dto.Title;
        if (dto.Description is not null) task.Description = dto.Description;
        if (dto.Status is not null) task.Status = dto.Status;
        if (dto.StartDate.HasValue) task.StartDate = NormalizeUtc(dto.StartDate.Value);
        if (dto.EndDate.HasValue) task.EndDate = NormalizeUtc(dto.EndDate.Value);
        if (dto.Priority is not null) task.Priority = dto.Priority;

        await _context.SaveChangesAsync();
        return NoContent();
    } 

    [HttpDelete("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> DeleteTask(int id) { var task = await _context.ProjectTasks.FindAsync(id); if (task is null) return NotFound(); await _trashService.MarkTaskDeletedAsync(task); await _context.SaveChangesAsync(); return Ok(task); }

    private static DateTime NormalizeUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };

    private void AddAssignmentNotification(Employee employee, ProjectTask task)
    {
        if (employee.NotificationsEnabled && !string.IsNullOrWhiteSpace(employee.UserId))
        {
            _context.Notifications.Add(new Notification
            {
                UserId = employee.UserId,
                Message = $"You have been assigned to the task \"{task.Title}\".",
                CreatedAt = DateTime.UtcNow
            });
        }
    }
}
