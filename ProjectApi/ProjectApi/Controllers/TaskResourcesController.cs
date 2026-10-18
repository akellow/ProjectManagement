using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;
using ProjectApi.Services;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TaskResourcesController : ControllerBase {
    private readonly AppDbContext _context;
    private readonly TrashService _trashService;
    public TaskResourcesController(AppDbContext context, TrashService trashService) { _context = context; _trashService = trashService; }

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
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<TaskResource>> CreateTaskResource(TaskResource taskResource) {
        _context.TaskResources.Add(taskResource);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetTaskResource), new { id = taskResource.TaskResourceId }, taskResource);
    }

    // PUT: api/taskresources/{id}
    [HttpPut("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> UpdateTaskResource(int id, TaskResource taskResource) {
        if (id != taskResource.TaskResourceId) return BadRequest();
        _context.Entry(taskResource).State = EntityState.Modified;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // DELETE: api/taskresources/{id}
    [HttpDelete("{id}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> DeleteTaskResource(int id) {
        var taskResource = await _context.TaskResources.FindAsync(id);
        if (taskResource is null) return NotFound();
        _trashService.MarkDeleted(taskResource, "Task resource", taskResource.TaskResourceId.ToString(), $"Task {taskResource.TaskId} · Resource {taskResource.ResourceId}");
        await _context.SaveChangesAsync();
        return Ok(taskResource);
    }
}
