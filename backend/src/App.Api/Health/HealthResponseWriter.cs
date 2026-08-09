using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace PortfolioTerminal.Api.Health;

internal static class HealthResponseWriter
{
    public static Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";

        var response = new
        {
            status = report.Status.ToString(),
            checks = report.Entries.ToDictionary(
                entry => entry.Key,
                entry => new
                {
                    status = entry.Value.Status.ToString(),
                    description = entry.Value.Description,
                }),
        };

        return context.Response.WriteAsync(JsonSerializer.Serialize(response));
    }
}
