using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;

namespace ProjectApi.Services;

public class TrashService
{
    private readonly AppDbContext _context;
    private readonly TaskAttachmentStorage _attachmentStorage;
    private readonly ILogger<TrashService> _logger;

    public TrashService(AppDbContext context, TaskAttachmentStorage attachmentStorage, ILogger<TrashService> logger)
    {
        _context = context;
        _attachmentStorage = attachmentStorage;
        _logger = logger;
    }

    public async Task<TrashEntry> MarkProjectDeletedAsync(Project project)
    {
        var tasks = await _context.ProjectTasks.IgnoreQueryFilters().Where(item => item.ProjectId == project.ProjectId).ToListAsync();
        var taskIds = tasks.Select(item => item.ProjectTaskId).ToList();
        var comments = await _context.TaskComments.IgnoreQueryFilters().Where(item => taskIds.Contains(item.TaskId)).ToListAsync();
        var subtasks = await _context.TaskSubtasks.IgnoreQueryFilters().Where(item => taskIds.Contains(item.TaskId)).ToListAsync();
        var attachments = await _context.TaskAttachments.IgnoreQueryFilters().Where(item => taskIds.Contains(item.TaskId)).ToListAsync();
        var resources = await _context.Resources.IgnoreQueryFilters().Where(item => item.ProjectId == project.ProjectId).ToListAsync();
        var resourceIds = resources.Select(item => item.ResourceId).ToList();
        var assignments = await _context.Assignments.IgnoreQueryFilters().Where(item => taskIds.Contains(item.TaskId)).ToListAsync();
        var taskResources = await _context.TaskResources.IgnoreQueryFilters().Where(item => taskIds.Contains(item.TaskId) || resourceIds.Contains(item.ResourceId)).ToListAsync();
        var milestones = await _context.Milestones.IgnoreQueryFilters().Where(item => item.ProjectId == project.ProjectId).ToListAsync();
        var risks = await _context.Risks.IgnoreQueryFilters().Where(item => item.ProjectId == project.ProjectId).ToListAsync();
        var communications = await _context.Communications.IgnoreQueryFilters().Where(item => item.ProjectId == project.ProjectId).ToListAsync();
        var projectEmployees = await _context.ProjectEmployees.IgnoreQueryFilters().Where(item => item.ProjectId == project.ProjectId).ToListAsync();
        var related = assignments.Cast<ISoftDeletable>()
            .Concat(taskResources).Concat(comments).Concat(subtasks).Concat(attachments).Concat(tasks).Concat(resources).Concat(milestones)
            .Concat(risks).Concat(communications).Concat(projectEmployees);
        await RemovePreviousTrashEntriesAsync(related);
        return MarkDeleted(project, "Project", project.ProjectId.ToString(), project.Name, related);
    }

    public async Task<TrashEntry> MarkTaskDeletedAsync(ProjectTask task)
    {
        var assignments = await _context.Assignments.IgnoreQueryFilters().Where(item => item.TaskId == task.ProjectTaskId).ToListAsync();
        var taskResources = await _context.TaskResources.IgnoreQueryFilters().Where(item => item.TaskId == task.ProjectTaskId).ToListAsync();
        var comments = await _context.TaskComments.IgnoreQueryFilters().Where(item => item.TaskId == task.ProjectTaskId).ToListAsync();
        var subtasks = await _context.TaskSubtasks.IgnoreQueryFilters().Where(item => item.TaskId == task.ProjectTaskId).ToListAsync();
        var attachments = await _context.TaskAttachments.IgnoreQueryFilters().Where(item => item.TaskId == task.ProjectTaskId).ToListAsync();
        var related = assignments.Cast<ISoftDeletable>().Concat(taskResources).Concat(comments).Concat(subtasks).Concat(attachments);
        await RemovePreviousTrashEntriesAsync(related);
        return MarkDeleted(task, "Task", task.ProjectTaskId.ToString(), task.Title, related);
    }

    public async Task<TrashEntry> MarkEmployeeDeletedAsync(Employee employee)
    {
        var assignments = await _context.Assignments.IgnoreQueryFilters().Where(item => item.EmployeeId == employee.EmployeeId).ToListAsync();
        var communications = await _context.Communications.IgnoreQueryFilters().Where(item => item.EmployeeId == employee.EmployeeId).ToListAsync();
        var projectEmployees = await _context.ProjectEmployees.IgnoreQueryFilters().Where(item => item.EmployeeId == employee.EmployeeId).ToListAsync();
        var related = assignments.Cast<ISoftDeletable>().Concat(communications).Concat(projectEmployees);
        await RemovePreviousTrashEntriesAsync(related);
        return MarkDeleted(employee, "Employee", employee.EmployeeId.ToString(), employee.Name, related);
    }

    public async Task<TrashEntry> MarkResourceDeletedAsync(Resource resource)
    {
        var taskResources = await _context.TaskResources.IgnoreQueryFilters().Where(item => item.ResourceId == resource.ResourceId).ToListAsync();
        await RemovePreviousTrashEntriesAsync(taskResources);
        return MarkDeleted(resource, "Resource", resource.ResourceId.ToString(), resource.Name, taskResources);
    }

    private async Task RemovePreviousTrashEntriesAsync(IEnumerable<ISoftDeletable> related)
    {
        var relatedItems = related.ToList();
        var groupIds = relatedItems.Where(item => item.IsDeleted && item.DeletionGroupId.HasValue)
            .Select(item => item.DeletionGroupId!.Value).Distinct().ToList();
        if (groupIds.Count == 0) return;
        var entries = await _context.TrashEntries.Where(item => groupIds.Contains(item.DeletionGroupId)).ToListAsync();
        var relatedRootKeys = relatedItems.Select(GetTrashKey).Where(key => key is not null)
            .Select(key => $"{key!.Value.EntityType}:{key.Value.EntityId}").ToHashSet();
        _context.TrashEntries.RemoveRange(entries.Where(entry => relatedRootKeys.Contains($"{entry.EntityType}:{entry.EntityId}")));
    }

    private static (string EntityType, string EntityId)? GetTrashKey(ISoftDeletable entity) => entity switch
    {
        Project item => ("Project", item.ProjectId.ToString()),
        ProjectTask item => ("Task", item.ProjectTaskId.ToString()),
        Employee item => ("Employee", item.EmployeeId.ToString()),
        Resource item => ("Resource", item.ResourceId.ToString()),
        Milestone item => ("Milestone", item.MilestoneId.ToString()),
        Risk item => ("Risk", item.RiskId.ToString()),
        Communication item => ("Communication", item.CommunicationId.ToString()),
        Assignment item => ("Assignment", item.AssignmentId.ToString()),
        ProjectEmployee item => ("Project assignment", item.ProjectEmployeeId.ToString()),
        TaskResource item => ("Task resource", item.TaskResourceId.ToString()),
        TaskComment item => ("Task comment", item.TaskCommentId.ToString()),
        TaskSubtask item => ("Task subtask", item.TaskSubtaskId.ToString()),
        TaskAttachment item => ("Task attachment", item.TaskAttachmentId.ToString()),
        _ => null
    };

    public TrashEntry MarkDeleted<T>(T root, string entityType, string entityId, string displayName, IEnumerable<ISoftDeletable>? related = null)
        where T : class, ISoftDeletable
    {
        var groupId = Guid.NewGuid();
        var deletedAt = DateTime.UtcNow;
        foreach (var entity in (related ?? Enumerable.Empty<ISoftDeletable>()).Append(root))
        {
            entity.IsDeleted = true;
            entity.DeletedAt = deletedAt;
            entity.DeletionGroupId = groupId;
        }

        var entry = new TrashEntry
        {
            EntityType = entityType,
            EntityId = entityId,
            DisplayName = displayName,
            DeletionGroupId = groupId,
            DeletedAt = deletedAt
        };
        _context.TrashEntries.Add(entry);
        return entry;
    }

    public async Task RestoreGroupAsync(Guid groupId, CancellationToken cancellationToken)
    {
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        await SetDeletedStateAsync(groupId, false, cancellationToken);
        var entry = await _context.TrashEntries.SingleOrDefaultAsync(item => item.DeletionGroupId == groupId, cancellationToken);
        if (entry is not null) _context.TrashEntries.Remove(entry);
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task PurgeExpiredAsync(DateTime cutoff, CancellationToken cancellationToken)
    {
        var expired = await _context.TrashEntries.Where(entry => entry.DeletedAt <= cutoff).ToListAsync(cancellationToken);
        if (expired.Count == 0) return;

        var attachmentNames = new List<string>();
        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        foreach (var entry in expired)
        {
            attachmentNames.AddRange(await DeleteGroupRowsAsync(entry.DeletionGroupId, cancellationToken));
            _context.TrashEntries.Remove(entry);
        }
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        foreach (var storageName in attachmentNames)
        {
            try
            {
                await _attachmentStorage.DeleteAsync(storageName, CancellationToken.None);
            }
            catch (IOException exception)
            {
                _logger.LogError(exception, "Unable to purge task attachment {StorageName} after trash group expiry.", storageName);
            }
            catch (UnauthorizedAccessException exception)
            {
                _logger.LogError(exception, "Insufficient permissions to purge task attachment {StorageName}.", storageName);
            }
        }
    }

    private async Task SetDeletedStateAsync(Guid groupId, bool isDeleted, CancellationToken cancellationToken)
    {
        await _context.Assignments.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.TaskResources.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.TaskComments.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.TaskSubtasks.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.TaskAttachments.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.ProjectEmployees.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.Milestones.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.Risks.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.Communications.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.ProjectTasks.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.Resources.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.Employees.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
        await _context.Projects.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId)
            .ExecuteUpdateAsync(update => update.SetProperty(item => item.IsDeleted, isDeleted).SetProperty(item => item.DeletedAt, (DateTime?)null).SetProperty(item => item.DeletionGroupId, (Guid?)null), cancellationToken);
    }

    private async Task<List<string>> DeleteGroupRowsAsync(Guid groupId, CancellationToken cancellationToken)
    {
        var attachmentNames = await _context.TaskAttachments.IgnoreQueryFilters()
            .Where(item => item.DeletionGroupId == groupId).Select(item => item.StorageName).ToListAsync(cancellationToken);

        var communicationIds = await _context.Communications.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).Select(item => item.CommunicationId).ToListAsync(cancellationToken);
        if (communicationIds.Count > 0)
            await _context.Notifications.Where(item => item.CommunicationId.HasValue && communicationIds.Contains(item.CommunicationId.Value)).ExecuteDeleteAsync(cancellationToken);

        await _context.Assignments.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.TaskResources.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.TaskComments.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.TaskSubtasks.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.TaskAttachments.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.ProjectEmployees.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.Milestones.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.Risks.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.Communications.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.ProjectTasks.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.Resources.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.Employees.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        await _context.Projects.IgnoreQueryFilters().Where(item => item.DeletionGroupId == groupId).ExecuteDeleteAsync(cancellationToken);
        return attachmentNames;
    }
}
