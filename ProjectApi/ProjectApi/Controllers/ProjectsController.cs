using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "AdminOnly")]
public class ProjectsController : ControllerBase {
    private readonly AppDbContext _context;
    public ProjectsController(AppDbContext context) => _context = context;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Project>>> GetProjects() =>
        await _context.Projects.ToListAsync();

    [HttpGet("{id}")]
    public async Task<ActionResult<Project>> GetProject(int id) {
        var project = await _context.Projects.FindAsync(id);
        return project is null ? NotFound() : project;
    }

    [HttpPost]
    public async Task<ActionResult<Project>> CreateProject(Project project) {
        _context.Projects.Add(project);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetProject), new { id = project.ProjectId }, project);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateProject(int id, Project project) {
        if (id != project.ProjectId) return BadRequest();
        _context.Entry(project).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteProject(int id) {
        var project = await _context.Projects.FindAsync(id);
        if (project is null) return NotFound();
        _context.Projects.Remove(project);
        await _context.SaveChangesAsync();
        return Ok(project);
    }
}
