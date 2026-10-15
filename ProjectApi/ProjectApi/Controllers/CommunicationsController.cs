using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CommunicationsController : ControllerBase {
    private readonly AppDbContext _context;
    public CommunicationsController(AppDbContext context) => _context = context;

    // GET: api/communications
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Communication>>> GetCommunications() =>
        await _context.Communications.ToListAsync();

    // GET: api/communications/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<Communication>> GetCommunication(int id) {
        var communication = await _context.Communications.FindAsync(id);
        return communication is null ? NotFound() : communication;
    }

    // POST: api/communications
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<Communication>> CreateCommunication(Communication communication) {
        var employee = await _context.Employees.FindAsync(communication.EmployeeId);
        if (employee is null) return BadRequest("A valid employee recipient is required.");
        if (!await _context.Projects.AnyAsync(project => project.ProjectId == communication.ProjectId))
            return BadRequest("A valid project is required.");

        _context.Communications.Add(communication);
        AddEmployeeNotification(employee, communication);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetCommunication), new { id = communication.CommunicationId }, communication);
    }

    // PUT: api/communications/{id}
    [HttpPut("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdateCommunication(int id, Communication communication) {
        if (id != communication.CommunicationId) return BadRequest();
        var existingCommunication = await _context.Communications.FindAsync(id);
        if (existingCommunication is null) return NotFound();

        var employee = await _context.Employees.FindAsync(communication.EmployeeId);
        if (employee is null) return BadRequest("A valid employee recipient is required.");
        if (!await _context.Projects.AnyAsync(project => project.ProjectId == communication.ProjectId))
            return BadRequest("A valid project is required.");

        existingCommunication.ProjectId = communication.ProjectId;
        existingCommunication.EmployeeId = communication.EmployeeId;
        existingCommunication.Message = communication.Message;
        existingCommunication.Date = communication.Date;
        AddEmployeeNotification(employee, existingCommunication);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE: api/communications/{id}
    [HttpDelete("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> DeleteCommunication(int id) {
        var communication = await _context.Communications.FindAsync(id);
        if (communication is null) return NotFound();
        _context.Communications.Remove(communication);
        await _context.SaveChangesAsync();
        return Ok(communication);
    }

    private void AddEmployeeNotification(Employee employee, Communication communication)
    {
        if (!employee.NotificationsEnabled || string.IsNullOrWhiteSpace(employee.UserId))
            return;

        _context.Notifications.Add(new ProjectApi.Models.Notification
        {
            UserId = employee.UserId,
            Communication = communication,
            Message = $"Communication from your project team: {communication.Message}",
            CreatedAt = DateTime.UtcNow
        });
    }
}
