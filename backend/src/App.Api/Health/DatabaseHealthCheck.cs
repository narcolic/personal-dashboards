using Microsoft.Extensions.Diagnostics.HealthChecks;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Api.Health;

internal sealed class DatabaseHealthCheck(AppDataSource dataSource) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        if (!dataSource.IsConfigured)
        {
            return HealthCheckResult.Unhealthy(
                "ConnectionStrings:AppDatabase is not configured.");
        }

        try
        {
            await using var connection = await dataSource
                .OpenConnectionAsync(cancellationToken)
                .ConfigureAwait(false);
            await using var command = connection.CreateCommand();
            command.CommandText = "select 1";
            await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);

            return HealthCheckResult.Healthy();
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy(
                "The PostgreSQL database is not reachable.", exception);
        }
    }
}
