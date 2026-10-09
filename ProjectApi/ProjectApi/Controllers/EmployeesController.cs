using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;
using System.Security.Claims;
using System.Text.Json;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EmployeesController : ControllerBase {
    private readonly AppDbContext _context;
    public EmployeesController(AppDbContext context) => _context = context;

    [HttpGet]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IEnumerable<Employee>> GetEmployees() => await _context.Employees.ToListAsync();

    [HttpGet("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<Employee>> GetEmployee(int id) => await _context.Employees.FindAsync(id) ?? (ActionResult<Employee>)NotFound();

    [HttpPost("sync")]
    [Authorize]
    public async Task<ActionResult<Employee>> SyncCurrentEmployee()
    {
        var userId = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var trustedRole = User.FindFirstValue("trusted_admin_role");
        var employeeRole = trustedRole ?? "User";
        var existingEmployee = await _context.Employees.FirstOrDefaultAsync(employee => employee.UserId == userId);
        if (existingEmployee is not null)
        {
            if (trustedRole is not null && existingEmployee.Role != trustedRole)
            {
                existingEmployee.Role = trustedRole;
                await _context.SaveChangesAsync();
            }
            return Ok(existingEmployee);
        }

        var email = User.FindFirstValue("email") ?? string.Empty;
        var name = User.FindFirstValue("name");
        var userMetadata = User.FindFirst("user_metadata")?.Value;
        if (string.IsNullOrWhiteSpace(name) && !string.IsNullOrWhiteSpace(userMetadata))
        {
            using var metadata = JsonDocument.Parse(userMetadata);
            if (metadata.RootElement.TryGetProperty("full_name", out var fullName)
                && fullName.ValueKind == JsonValueKind.String)
            {
                name = fullName.GetString();
            }
        }

        var employee = new Employee
        {
            Name = string.IsNullOrWhiteSpace(name) ? email : name.Trim(),
            Role = employeeRole,
            ContactInfo = email,
            UserId = userId,
        };
        _context.Employees.Add(employee);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetEmployee), new { id = employee.EmployeeId }, employee);
    }

    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<Employee>> CreateEmployee(Employee employee) { _context.Employees.Add(employee); await _context.SaveChangesAsync(); return CreatedAtAction(nameof(GetEmployee), new { id = employee.EmployeeId }, employee); }

    [HttpPut("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdateEmployee(int id, Employee employee) { if (id != employee.EmployeeId) return BadRequest(); _context.Entry(employee).State = EntityState.Modified; await _context.SaveChangesAsync(); return NoContent(); }

    [HttpDelete("{id}")]
    [Authorize(Policy = "AdminOnly")]
    [Authorize(Roles = "admin,superadmin")]
    public async Task<IActionResult> DeleteEmployee(int id)
    {
        var employee = await _context.Employees.FindAsync(id);
        if (employee is null) return NotFound();

        var currentUserId = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!string.IsNullOrWhiteSpace(currentUserId) && employee.UserId == currentUserId)
            return BadRequest("You cannot remove your own employee profile.");

        _context.Employees.Remove(employee);
        await _context.SaveChangesAsync();
        return Ok(employee);
    }
}
