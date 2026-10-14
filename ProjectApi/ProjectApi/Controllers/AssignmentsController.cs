using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AssignmentsController : ControllerBase
{
    private readonly AppDbContext _context;

    public AssignmentsController(AppDbContext context) => _context = context;

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
        _context.Assignments.Remove(assignment);
        await _context.SaveChangesAsync();
        return Ok(assignment);
    }
}
