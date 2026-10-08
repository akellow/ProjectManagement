using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "AdminOnly")]
public class ResourcesController : ControllerBase {
    private readonly AppDbContext _context;
    public ResourcesController(AppDbContext context) => _context = context;

    // GET: api/resources
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Resource>>> GetResources() =>
        await _context.Resources.Include(resource => resource.Project).ToListAsync();

    // GET: api/resources/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<Resource>> GetResource(int id) {
        var resource = await _context.Resources.FindAsync(id);
        return resource is null ? NotFound() : resource;
    }

    // POST: api/resources
    [HttpPost]
    public async Task<ActionResult<Resource>> CreateResource(Resource resource) {
        if (!await _context.Projects.AnyAsync(project => project.ProjectId == resource.ProjectId))
            return BadRequest("A valid project is required for every resource.");
        _context.Resources.Add(resource);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetResource), new { id = resource.ResourceId }, resource);
    }

    // PUT: api/resources/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateResource(int id, Resource resource) {
        if (id != resource.ResourceId) return BadRequest();
        if (!await _context.Projects.AnyAsync(project => project.ProjectId == resource.ProjectId))
            return BadRequest("A valid project is required for every resource.");
        _context.Entry(resource).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE: api/resources/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteResource(int id) {
        var resource = await _context.Resources.FindAsync(id);
        if (resource is null) return NotFound();
        _context.Resources.Remove(resource);
        await _context.SaveChangesAsync();
        return Ok(resource);
    }
}
