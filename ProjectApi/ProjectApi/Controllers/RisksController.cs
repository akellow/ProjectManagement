using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "AdminOnly")]
public class RisksController : ControllerBase {
    private readonly AppDbContext _context;
    public RisksController(AppDbContext context) => _context = context;

    // GET: api/risks
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Risk>>> GetRisks() =>
        await _context.Risks.ToListAsync();

    // GET: api/risks/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<Risk>> GetRisk(int id) {
        var risk = await _context.Risks.FindAsync(id);
        return risk is null ? NotFound() : risk;
    }

    // POST: api/risks
    [HttpPost]
    public async Task<ActionResult<Risk>> CreateRisk(Risk risk) {
        _context.Risks.Add(risk);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetRisk), new { id = risk.RiskId }, risk);
    }

    // PUT: api/risks/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateRisk(int id, Risk risk) {
        if (id != risk.RiskId) return BadRequest();
        _context.Entry(risk).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE: api/risks/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteRisk(int id) {
        var risk = await _context.Risks.FindAsync(id);
        if (risk is null) return NotFound();
        _context.Risks.Remove(risk);
        await _context.SaveChangesAsync();
        return Ok(risk);
    }
}
