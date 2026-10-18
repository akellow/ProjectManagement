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
public class AssignmentsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly TrashService _trashService;

    public AssignmentsController(AppDbContext context, TrashService trashService) { _context = context; _trashService = trashService; }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Assignment>>> GetAssignments() =>
        await _context.Assignments.ToListAsync();

    [HttpGet("{id}")]
    public async Task<ActionResult<Assignment>> GetAssignment(int id)
    {
        var assignment = await _context.Assignments.FindAsync(id);
        return assignment is null ? NotFound() : assignment;
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<Assignment>> CreateAssignment(Assignment assignment)
    {
        var employee = await _context.Employees.FindAsync(assignment.EmployeeId);
        var task = await _context.ProjectTasks.FindAsync(assignment.TaskId);
        if (employee is null || task is null)
            return BadRequest("A valid task and employee are required.");
        if (assignment.HoursAllocated < 1)
            return BadRequest("The assigned period must be at least one hour.");
        if (await _context.Assignments.AnyAsync(item => item.TaskId == assignment.TaskId && item.EmployeeId == assignment.EmployeeId))
            return Conflict("This employee is already assigned to the task.");

        _context.Assignments.Add(assignment);
        if (employee.NotificationsEnabled && !string.IsNullOrWhiteSpace(employee.UserId))
        {
            _context.Notifications.Add(new Notification
            {
                UserId = employee.UserId,
                Message = $"You have been assigned to the task \"{task.Title}\".",
                CreatedAt = DateTime.UtcNow
            });
        }
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetAssignment), new { id = assignment.AssignmentId }, assignment);
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> DeleteAssignment(int id)
    {
        var assignment = await _context.Assignments.FindAsync(id);
        if (assignment is null) return NotFound();
        if (await _context.Assignments.CountAsync(item => item.TaskId == assignment.TaskId) <= 1)
            return Conflict("A task must have at least one assigned employee.");
        _trashService.MarkDeleted(assignment, "Assignment", assignment.AssignmentId.ToString(), $"Task {assignment.TaskId} · Employee {assignment.EmployeeId}");
        await _context.SaveChangesAsync();
        return Ok(assignment);
    }
}
