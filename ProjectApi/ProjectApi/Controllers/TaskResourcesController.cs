using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "AdminOnly")]
public class TaskResourcesController : ControllerBase {
    private readonly AppDbContext _context;
    public TaskResourcesController(AppDbContext context) => _context = context;

    // GET: api/taskresources
    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskResource>>> GetTaskResources() =>
        await _context.TaskResources.ToListAsync();

    // GET: api/taskresources/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<TaskResource>> GetTaskResource(int id) {
        var taskResource = await _context.TaskResources.FindAsync(id);
        return taskResource is null ? NotFound() : taskResource;
    }

    // POST: api/taskresources
    [HttpPost]
    public async Task<ActionResult<TaskResource>> CreateTaskResource(TaskResource taskResource) {
        _context.TaskResources.Add(taskResource);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetTaskResource), new { id = taskResource.TaskResourceId }, taskResource);
    }

    // PUT: api/taskresources/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateTaskResource(int id, TaskResource taskResource) {
        if (id != taskResource.TaskResourceId) return BadRequest();
        _context.Entry(taskResource).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE: api/taskresources/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTaskResource(int id) {
        var taskResource = await _context.TaskResources.FindAsync(id);
        if (taskResource is null) return NotFound();
        _context.TaskResources.Remove(taskResource);
        await _context.SaveChangesAsync();
        return Ok(taskResource);
    }
}
