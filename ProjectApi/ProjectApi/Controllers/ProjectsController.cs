using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
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
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<Project>> CreateProject(Project project) {
        project.StartDate = NormalizeUtc(project.StartDate);
        project.EndDate = NormalizeUtc(project.EndDate);
        _context.Projects.Add(project);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetProject), new { id = project.ProjectId }, project);
    }

    [HttpPut("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdateProject(int id, Project project) {
        if (id != project.ProjectId) return BadRequest();

        var existingProject = await _context.Projects.FindAsync(id);
        if (existingProject is null) return NotFound();

        existingProject.Name = project.Name;
        existingProject.Description = project.Description;
        existingProject.StartDate = NormalizeUtc(project.StartDate);
        existingProject.EndDate = NormalizeUtc(project.EndDate);
        existingProject.Budget = project.Budget;
        existingProject.Status = project.Status;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> DeleteProject(int id) {
        var project = await _context.Projects.FindAsync(id);
        if (project is null) return NotFound();
        _context.Projects.Remove(project);
        await _context.SaveChangesAsync();
        return Ok(project);
    }

    private static DateTime NormalizeUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}
