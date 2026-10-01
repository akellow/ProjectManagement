using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProjectEmployeesController : ControllerBase
{
    private readonly AppDbContext _context;
    public ProjectEmployeesController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProjectEmployee>>> GetAssignments() =>
        await _context.ProjectEmployees.ToListAsync();

    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<ProjectEmployee>> Assign(ProjectEmployee assignment)
    {
        if (!await _context.Projects.AnyAsync(project => project.ProjectId == assignment.ProjectId) ||
            !await _context.Employees.AnyAsync(employee => employee.EmployeeId == assignment.EmployeeId))
            return BadRequest("A valid project and employee are required.");
        if (await _context.ProjectEmployees.AnyAsync(item => item.ProjectId == assignment.ProjectId && item.EmployeeId == assignment.EmployeeId))
            return Conflict("Employee is already assigned to this project.");
        _context.ProjectEmployees.Add(assignment);
        await _context.SaveChangesAsync();
        return Ok(assignment);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> Remove(int id)
    {
        var assignment = await _context.ProjectEmployees.FindAsync(id);
        if (assignment is null) return NotFound();
        _context.ProjectEmployees.Remove(assignment);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
