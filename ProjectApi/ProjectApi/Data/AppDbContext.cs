using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using ProjectApi.Models;

namespace ProjectApi.Data;

public class AppDbContext : IdentityDbContext<ApplicationUser> {
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) {}

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<AuditLog>().HasIndex(log => log.Timestamp);
        modelBuilder.Entity<Notification>().HasIndex(notification => notification.UserId);
    }

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

}
