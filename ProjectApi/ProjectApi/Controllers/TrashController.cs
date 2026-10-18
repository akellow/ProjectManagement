using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;
using ProjectApi.Services;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Policy = "AdminOnly")]
public class TrashController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly TrashService _trashService;

    public TrashController(AppDbContext context, TrashService trashService)
    {
        _context = context;
        _trashService = trashService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TrashEntry>>> GetTrash(CancellationToken cancellationToken) =>
        await _context.TrashEntries.OrderByDescending(item => item.DeletedAt).ToListAsync(cancellationToken);

    [HttpPost("{id:int}/restore")]
    public async Task<IActionResult> Restore(int id, CancellationToken cancellationToken)
    {
        var entry = await _context.TrashEntries.FindAsync([id], cancellationToken);
        if (entry is null) return NotFound();
        if (entry.DeletedAt <= DateTime.UtcNow.AddDays(-30))
        {
            await _trashService.PurgeExpiredAsync(DateTime.UtcNow.AddDays(-30), cancellationToken);
            return StatusCode(StatusCodes.Status410Gone, "This item has passed the 30-day recovery period.");
        }

        var dependencyError = await ValidateGroupDependenciesAsync(entry.DeletionGroupId, cancellationToken);
        if (dependencyError is not null) return Conflict(dependencyError);

        var assignments = await _context.Assignments.IgnoreQueryFilters()
            .Where(item => item.DeletionGroupId == entry.DeletionGroupId)
            .ToListAsync(cancellationToken);
        foreach (var assignment in assignments)
        {
            if (await _context.Assignments.AnyAsync(item => item.TaskId == assignment.TaskId && item.EmployeeId == assignment.EmployeeId, cancellationToken))
                return Conflict("An employee has already been assigned to this task. Resolve the duplicate before restoring this item.");
        }

        var projectAssignments = await _context.ProjectEmployees.IgnoreQueryFilters()
            .Where(item => item.DeletionGroupId == entry.DeletionGroupId)
            .ToListAsync(cancellationToken);
        foreach (var assignment in projectAssignments)
        {
            if (await _context.ProjectEmployees.AnyAsync(item => item.ProjectId == assignment.ProjectId && item.EmployeeId == assignment.EmployeeId, cancellationToken))
                return Conflict("An employee has already been assigned to this project. Resolve the duplicate before restoring this item.");
        }

        await _trashService.RestoreGroupAsync(entry.DeletionGroupId, cancellationToken);
        return NoContent();
    }

    private async Task<string?> ValidateGroupDependenciesAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var projects = await _context.Projects.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).Select(item => item.ProjectId).ToListAsync(cancellationToken);
        var tasks = await _context.ProjectTasks.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ToListAsync(cancellationToken);
        var employees = await _context.Employees.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).Select(item => item.EmployeeId).ToListAsync(cancellationToken);
        var resources = await _context.Resources.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).Select(item => item.ResourceId).ToListAsync(cancellationToken);
        var assignments = await _context.Assignments.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ToListAsync(cancellationToken);
        var taskResources = await _context.TaskResources.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ToListAsync(cancellationToken);
        var projectEmployees = await _context.ProjectEmployees.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ToListAsync(cancellationToken);
        var milestones = await _context.Milestones.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ToListAsync(cancellationToken);
        var risks = await _context.Risks.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ToListAsync(cancellationToken);
        var communications = await _context.Communications.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ToListAsync(cancellationToken);

        var projectIds = tasks.Select(item => item.ProjectId)
            .Concat(_context.Resources.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).Select(item => item.ProjectId))
            .Concat(milestones.Select(item => item.ProjectId))
            .Concat(risks.Select(item => item.ProjectId))
            .Concat(communications.Select(item => item.ProjectId))
            .Concat(projectEmployees.Select(item => item.ProjectId))
            .Except(projects).Distinct().ToList();
        if (projectIds.Count > 0)
        {
            var active = await _context.Projects.Where(item => projectIds.Contains(item.ProjectId)).Select(item => item.ProjectId).ToListAsync(cancellationToken);
            if (active.Count != projectIds.Count) return "Restore the related project before restoring this item.";
        }

        var taskIds = assignments.Select(item => item.TaskId)
            .Concat(taskResources.Select(item => item.TaskId))
            .Except(tasks.Select(item => item.ProjectTaskId)).Distinct().ToList();
        if (taskIds.Count > 0)
        {
            var active = await _context.ProjectTasks.Where(item => taskIds.Contains(item.ProjectTaskId)).Select(item => item.ProjectTaskId).ToListAsync(cancellationToken);
            if (active.Count != taskIds.Count) return "Restore the related task before restoring this item.";
        }

        var resourceIds = taskResources.Select(item => item.ResourceId).Except(resources).Distinct().ToList();
        if (resourceIds.Count > 0)
        {
            var active = await _context.Resources.Where(item => resourceIds.Contains(item.ResourceId)).Select(item => item.ResourceId).ToListAsync(cancellationToken);
            if (active.Count != resourceIds.Count) return "Restore the related resource before restoring this item.";
        }

        var employeeIds = assignments.Select(item => item.EmployeeId)
            .Concat(projectEmployees.Select(item => item.EmployeeId))
            .Concat(communications.Select(item => item.EmployeeId))
            .Except(employees).Distinct().ToList();
        if (employeeIds.Count > 0)
        {
            var active = await _context.Employees.Where(item => employeeIds.Contains(item.EmployeeId)).Select(item => item.EmployeeId).ToListAsync(cancellationToken);
            if (active.Count != employeeIds.Count) return "Restore the related employee before restoring this item.";
        }

        return null;
    }
}
