using Microsoft.EntityFrameworkCore;
using ProjectApi.Data;

namespace ProjectApi.Services;

public sealed class OverdueStatusService(
    IServiceScopeFactory scopeFactory,
    ILogger<OverdueStatusService> logger) : BackgroundService
{
    private static readonly TimeZoneInfo EastAfricaTimeZone = TimeZoneInfo.FindSystemTimeZoneById(
        OperatingSystem.IsWindows() ? "E. Africa Standard Time" : "Africa/Nairobi");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await MarkOverdueItemsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Failed to update overdue project and task statuses.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }

    private async Task MarkOverdueItemsAsync(CancellationToken cancellationToken)
    {
        var nowEastAfrica = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, EastAfricaTimeZone);
        var today = nowEastAfrica.Date;

        await using var scope = scopeFactory.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var projects = await context.Projects
            .Where(project => project.Status.ToLower() != "completed" && project.Status.ToLower() != "overdue")
            .ToListAsync(cancellationToken);
        var tasks = await context.ProjectTasks
            .Where(task => task.Status.ToLower() != "completed" && task.Status.ToLower() != "overdue")
            .ToListAsync(cancellationToken);

        var changedCount = 0;
        foreach (var project in projects)
        {
            if (EastAfricaDate(project.EndDate) >= today) continue;
            project.Status = "Overdue";
            changedCount++;
        }

        foreach (var task in tasks)
        {
            if (EastAfricaDate(task.EndDate) >= today) continue;
            task.Status = "Overdue";
            changedCount++;
        }

        if (changedCount == 0) return;
        await context.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Marked {Count} projects and tasks as overdue.", changedCount);
    }

    private static DateTime EastAfricaDate(DateTime value)
    {
        var utcValue = DateTime.SpecifyKind(value, DateTimeKind.Utc);
        return TimeZoneInfo.ConvertTimeFromUtc(utcValue, EastAfricaTimeZone).Date;
    }
}
