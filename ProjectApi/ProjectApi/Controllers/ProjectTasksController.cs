using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "AdminOnly")]
public class ProjectTasksController : ControllerBase {
    private readonly AppDbContext _context;
    public ProjectTasksController(AppDbContext context) => _context = context;

    [HttpGet] public IEnumerable<ProjectTask> Get() => _context.ProjectTasks.ToList();
    [HttpGet("{id}")] public ActionResult<ProjectTask> GetById(int id)
    {
        var task = _context.ProjectTasks.Find(id);
        if (task == null)
        {
            return NotFound();
        }
        return task;
    }
    [HttpPost] [Authorize(Roles = "admin")] public async Task<ActionResult<ProjectTask>> CreateTask(ProjectTask task)
    {
        if (task == null)
        {
            return BadRequest("Task Data is required.");
        }
        task.StartDate = NormalizeUtc(task.StartDate);
        task.EndDate = NormalizeUtc(task.EndDate);
        _context.ProjectTasks.Add(task);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = task.ProjectTaskId }, task);
    }
    [HttpPut("{id}")] [Authorize(Roles = "admin")] public async Task<IActionResult> PutProjectTask(int id, ProjectTaskUpdateDto dto)
    {
        var task = await _context.ProjectTasks.FindAsync(id);
        if (task == null) return NotFound();

        if (dto.Title is not null) task.Title = dto.Title;
        if (dto.Description is not null) task.Description = dto.Description;
        if (dto.Status is not null) task.Status = dto.Status;
        if (dto.StartDate.HasValue) task.StartDate = NormalizeUtc(dto.StartDate.Value);
        if (dto.EndDate.HasValue) task.EndDate = NormalizeUtc(dto.EndDate.Value);
        if (dto.Priority is not null) task.Priority = dto.Priority;

        await _context.SaveChangesAsync();
        return NoContent();
    } 

    [HttpDelete("{id}")] [Authorize(Roles = "admin")] public async Task<IActionResult> DeleteTask(int id) { var task = await _context.ProjectTasks.FindAsync(id); if (task is null) return NotFound(); _context.ProjectTasks.Remove(task); await _context.SaveChangesAsync(); return Ok(task); }

    private static DateTime NormalizeUtc(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
    };
}
