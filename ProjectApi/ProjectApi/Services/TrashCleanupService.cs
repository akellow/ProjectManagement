using ProjectApi.Data;

namespace ProjectApi.Services;

public class TrashCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<TrashCleanupService> _logger;

    public TrashCleanupService(IServiceScopeFactory scopeFactory, ILogger<TrashCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var trashService = scope.ServiceProvider.GetRequiredService<TrashService>();
                await trashService.PurgeExpiredAsync(DateTime.UtcNow.AddDays(-30), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Failed to permanently remove expired trash records.");
            }

            await Task.Delay(TimeSpan.FromHours(6), stoppingToken);
        }
    }
}
