using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MilestonesController : ControllerBase {
    private readonly AppDbContext _context;
    public MilestonesController(AppDbContext context) => _context = context;

    // GET: api/milestones
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Milestone>>> GetMilestones() =>
        await _context.Milestones.ToListAsync();

    // GET: api/milestones/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<Milestone>> GetMilestone(int id) {
        var milestone = await _context.Milestones.FindAsync(id);
        return milestone is null ? NotFound() : milestone;
    }

    // POST: api/milestones
    [HttpPost]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<Milestone>> CreateMilestone(Milestone milestone) {
        _context.Milestones.Add(milestone);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetMilestone), new { id = milestone.MilestoneId }, milestone);
    }

    // PUT: api/milestones/{id}
    [HttpPut("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> UpdateMilestone(int id, Milestone milestone) {
        if (id != milestone.MilestoneId) return BadRequest();
        _context.Entry(milestone).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE: api/milestones/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> DeleteMilestone(int id) {
        var milestone = await _context.Milestones.FindAsync(id);
        if (milestone is null) return NotFound();
        _context.Milestones.Remove(milestone);
        await _context.SaveChangesAsync();
        return Ok(milestone);
    }
}
