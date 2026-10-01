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
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<Communication>> CreateCommunication(Communication communication) {
        var employee = await _context.Employees.FindAsync(communication.EmployeeId);
        if (employee is null) return BadRequest("A valid employee recipient is required.");
        _context.Communications.Add(communication);
        await _context.SaveChangesAsync();
        if (!string.IsNullOrWhiteSpace(employee.UserId))
        {
            var recipient = await _context.Users.FindAsync(employee.UserId);
            if (recipient?.NotificationsEnabled == true)
            {
                _context.Notifications.Add(new ProjectApi.Models.Notification
                {
                    UserId = employee.UserId,
                    CommunicationId = communication.CommunicationId,
                    Message = communication.Message,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }
        }
        return CreatedAtAction(nameof(GetCommunication), new { id = communication.CommunicationId }, communication);
    }

    // PUT: api/communications/{id}
    [HttpPut("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateCommunication(int id, Communication communication) {
        if (id != communication.CommunicationId) return BadRequest();
        _context.Entry(communication).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE: api/communications/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteCommunication(int id) {
        var communication = await _context.Communications.FindAsync(id);
        if (communication is null) return NotFound();
        _context.Communications.Remove(communication);
        await _context.SaveChangesAsync();
        return Ok(communication);
    }
}
