using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using ProjectApi.Models;
using System.Reflection;

namespace ProjectApi.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser> {
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<AuditLog>().HasIndex(log => log.Timestamp);
        modelBuilder.Entity<Notification>().HasIndex(notification => notification.UserId);
        modelBuilder.Entity<TrashEntry>().HasIndex(entry => entry.DeletionGroupId);
        modelBuilder.Entity<TaskComment>().HasOne<ProjectTask>().WithMany().HasForeignKey(comment => comment.TaskId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<TaskSubtask>().HasOne<ProjectTask>().WithMany().HasForeignKey(subtask => subtask.TaskId).OnDelete(DeleteBehavior.Cascade);
        modelBuilder.Entity<TaskAttachment>().HasOne<ProjectTask>().WithMany().HasForeignKey(attachment => attachment.TaskId).OnDelete(DeleteBehavior.Cascade);

        var configureFilter = typeof(AppDbContext).GetMethod(nameof(ConfigureSoftDeleteFilter), BindingFlags.NonPublic | BindingFlags.Static)
            ?? throw new InvalidOperationException("Unable to configure soft-delete query filters.");
        foreach (var entityType in modelBuilder.Model.GetEntityTypes().Where(type => typeof(ISoftDeletable).IsAssignableFrom(type.ClrType)))
            configureFilter.MakeGenericMethod(entityType.ClrType).Invoke(null, [modelBuilder]);
    }

    private static void ConfigureSoftDeleteFilter<TEntity>(ModelBuilder modelBuilder) where TEntity : class, ISoftDeletable =>
        modelBuilder.Entity<TEntity>().HasQueryFilter(entity => !entity.IsDeleted);

    public DbSet<Project> Projects { get; set; }
    public DbSet<ProjectTask> ProjectTasks { get; set; }
    public DbSet<Employee> Employees { get; set; }
    public DbSet<Assignment> Assignments { get; set; }
    public DbSet<Resource> Resources { get; set; }
    public DbSet<TaskResource> TaskResources { get; set; }
    public DbSet<Milestone> Milestones { get; set; }
    public DbSet<Risk> Risks { get; set; }
    public DbSet<Communication> Communications { get; set; }
    public DbSet<ProjectEmployee> ProjectEmployees { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<TrashEntry> TrashEntries { get; set; }
    public DbSet<TaskComment> TaskComments { get; set; }
    public DbSet<TaskSubtask> TaskSubtasks { get; set; }
    public DbSet<TaskAttachment> TaskAttachments { get; set; }

}
