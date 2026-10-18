using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;
using ProjectApi.Models;
using ProjectApi.Services;
using Path = System.IO.Path;

namespace ProjectApi.Controllers;

[ApiController]
[Route("api/ProjectTasks/{taskId:int}/collaboration")]
[Authorize]
public class TaskCollaborationController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly TaskAttachmentStorage _attachmentStorage;

    public TaskCollaborationController(AppDbContext context, TaskAttachmentStorage attachmentStorage)
    {
        _context = context;
        _attachmentStorage = attachmentStorage;
    }

    [HttpGet]
    public async Task<IActionResult> Get(int taskId, CancellationToken cancellationToken)
    {
        if (!await _context.ProjectTasks.AnyAsync(task => task.ProjectTaskId == taskId, cancellationToken))
            return NotFound();

        var comments = await _context.TaskComments.Where(comment => comment.TaskId == taskId)
            .OrderByDescending(comment => comment.CreatedAt).ToListAsync(cancellationToken);
        var subtasks = await _context.TaskSubtasks.Where(subtask => subtask.TaskId == taskId)
            .OrderBy(subtask => subtask.CreatedAt).ToListAsync(cancellationToken);
        var attachments = await _context.TaskAttachments.Where(attachment => attachment.TaskId == taskId)
            .OrderByDescending(attachment => attachment.UploadedAt)
            .Select(attachment => new TaskAttachmentDto(
                attachment.TaskAttachmentId,
                attachment.FileName,
                attachment.ContentType,
                attachment.Size,
                attachment.UploadedByUserId,
                attachment.UploadedAt))
            .ToListAsync(cancellationToken);
        return Ok(new { comments, subtasks, attachments });
    }

    [HttpPost("comments")]
    public async Task<ActionResult<TaskComment>> AddComment(int taskId, CreateTaskCommentDto dto, CancellationToken cancellationToken)
    {
        if (!await _context.ProjectTasks.AnyAsync(task => task.ProjectTaskId == taskId, cancellationToken))
            return NotFound();

        var userId = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var name = User.FindFirstValue("name")
            ?? User.FindFirstValue("preferred_username")
            ?? User.FindFirstValue("email")
            ?? "Team member";
        var comment = new TaskComment { TaskId = taskId, AuthorUserId = userId, AuthorName = name, Content = dto.Content.Trim() };
        _context.TaskComments.Add(comment);
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(comment);
    }

    [HttpPost("subtasks")]
    public async Task<ActionResult<TaskSubtask>> AddSubtask(int taskId, CreateTaskSubtaskDto dto, CancellationToken cancellationToken)
    {
        if (!await _context.ProjectTasks.AnyAsync(task => task.ProjectTaskId == taskId, cancellationToken))
            return NotFound();

        var subtask = new TaskSubtask { TaskId = taskId, Title = dto.Title.Trim() };
        _context.TaskSubtasks.Add(subtask);
        await _context.SaveChangesAsync(cancellationToken);
        return Ok(subtask);
    }

    [HttpPut("subtasks/{subtaskId:int}")]
    public async Task<IActionResult> UpdateSubtask(int taskId, int subtaskId, UpdateTaskSubtaskDto dto, CancellationToken cancellationToken)
    {
        var subtask = await _context.TaskSubtasks.SingleOrDefaultAsync(item =>
            item.TaskId == taskId && item.TaskSubtaskId == subtaskId, cancellationToken);
        if (subtask is null) return NotFound();
        subtask.IsCompleted = dto.IsCompleted;
        await _context.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("attachments")]
    [RequestSizeLimit(TaskAttachmentStorage.MaximumFileSize + 1024 * 1024)]
    public async Task<ActionResult<TaskAttachmentDto>> AddAttachment(int taskId, IFormFile file, CancellationToken cancellationToken)
    {
        if (!await _context.ProjectTasks.AnyAsync(task => task.ProjectTaskId == taskId, cancellationToken))
            return NotFound();
        if (file is null) return BadRequest("Choose a file to upload.");

        var userId = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var safeFileName = Path.GetFileName(file.FileName.Replace('\\', '/')).Trim();
        if (safeFileName.Length is 0 or > 255)
            return BadRequest("The file name must be between 1 and 255 characters.");
        string storageName;
        try
        {
            storageName = await _attachmentStorage.SaveAsync(file, cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(exception.Message);
        }

        var attachment = new TaskAttachment
        {
            TaskId = taskId,
            FileName = safeFileName,
            StorageName = storageName,
            ContentType = _attachmentStorage.GetContentType(safeFileName),
            Size = file.Length,
            UploadedByUserId = userId
        };

        try
        {
            _context.TaskAttachments.Add(attachment);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await _attachmentStorage.DeleteAsync(storageName, CancellationToken.None);
            throw;
        }

        return Ok(ToDto(attachment));
    }

    [HttpGet("attachments/{attachmentId:int}")]
    public async Task<IActionResult> DownloadAttachment(int taskId, int attachmentId, CancellationToken cancellationToken)
    {
        var attachment = await _context.TaskAttachments.SingleOrDefaultAsync(item =>
            item.TaskId == taskId && item.TaskAttachmentId == attachmentId, cancellationToken);
        if (attachment is null) return NotFound();
        try
        {
            return File(_attachmentStorage.OpenRead(attachment.StorageName), attachment.ContentType, attachment.FileName);
        }
        catch (FileNotFoundException)
        {
            return Problem("The attachment file is missing from API storage.", statusCode: StatusCodes.Status410Gone);
        }
    }

    private static TaskAttachmentDto ToDto(TaskAttachment attachment) => new(
        attachment.TaskAttachmentId,
        attachment.FileName,
        attachment.ContentType,
        attachment.Size,
        attachment.UploadedByUserId,
        attachment.UploadedAt);

    public sealed record TaskAttachmentDto(int TaskAttachmentId, string FileName, string ContentType, long Size, string UploadedByUserId, DateTime UploadedAt);
    public sealed class CreateTaskCommentDto
    {
        [Required, StringLength(5000)]
        public string Content { get; set; } = string.Empty;
    }

    public sealed class CreateTaskSubtaskDto
    {
        [Required, StringLength(300)]
        public string Title { get; set; } = string.Empty;
    }

    public sealed class UpdateTaskSubtaskDto
    {
        public bool IsCompleted { get; set; }
    }
}
