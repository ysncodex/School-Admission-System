using Microsoft.EntityFrameworkCore;
using SchoolAdmission.Api.Data;
using SchoolAdmission.Api.Domain;

namespace SchoolAdmission.Api.Services;

public sealed class HoldExpirationService(
    IServiceScopeFactory scopeFactory,
    ILogger<HoldExpirationService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(1));
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<SchoolAdmissionDbContext>();
                var now = DateTimeOffset.UtcNow;
                var expired = await db.Applications
                    .Where(x => x.Status == ApplicationStatus.HELD && x.ExpiresAt <= now)
                    .ExecuteUpdateAsync(setters =>
                        setters.SetProperty(x => x.Status, ApplicationStatus.EXPIRED), stoppingToken);

                if (expired > 0)
                    logger.LogInformation("Expired {Count} admission hold(s).", expired);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Failed to expire stale admission holds. The worker will retry.");
            }

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
