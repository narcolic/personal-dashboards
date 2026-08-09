using PortfolioTerminal.CarService.Reminders;
using PortfolioTerminal.CarService.Visits;

namespace PortfolioTerminal.Tests;

public sealed class ServiceReminderCalculatorTests
{
    [Fact]
    public void CalculateReturnsDueSoonFromMileageAndUsesLatestMatchingJob()
    {
        var userId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var reminder = Reminder(userId, vehicleId, "Oil change", 15_000, 12, 5_000, 30);
        var visits = new[]
        {
            Visit(userId, vehicleId, new DateOnly(2026, 7, 1), 20_000, "Tyres"),
            Visit(userId, vehicleId, new DateOnly(2026, 1, 31), 10_000, " oil CHANGE "),
        };

        var result = Assert.Single(ServiceReminderCalculator.Calculate(
            [reminder],
            visits,
            new DateTimeOffset(2026, 8, 9, 12, 0, 0, TimeSpan.Zero),
            useLatestVisitOdometer: true));

        Assert.Equal("DUE SOON", result.Status);
        Assert.Equal(new DateOnly(2026, 1, 31), result.LastDoneDate);
        Assert.Equal(10_000, result.LastDoneKm);
        Assert.Equal(5_000, result.KmRemaining);
    }

    [Fact]
    public void CalculatePreservesJavaScriptMonthOverflowAndNoDataDefaults()
    {
        var userId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var monthly = Reminder(userId, vehicleId, "Inspection", null, 1, null, 11);
        var missing = Reminder(userId, vehicleId, "Unknown", 1_000, null, 100, null);
        var visits = new[]
        {
            Visit(userId, vehicleId, new DateOnly(2026, 1, 31), 10_000, "Inspection"),
        };

        var results = ServiceReminderCalculator.Calculate(
            [monthly, missing],
            visits,
            new DateTimeOffset(2026, 2, 20, 12, 0, 0, TimeSpan.Zero),
            useLatestVisitOdometer: false);

        Assert.Equal("OVERDUE", results[0].Status);
        Assert.Equal(11, results[0].DaysRemaining);
        Assert.Equal("NO DATA", results[1].Status);
        Assert.Null(results[1].LastDoneDate);
        Assert.Null(results[1].KmRemaining);
        Assert.Null(results[1].DaysRemaining);
    }

    private static ServiceReminderListItem Reminder(
        Guid userId,
        Guid vehicleId,
        string jobName,
        int? intervalKm,
        int? intervalMonths,
        int? warningKm,
        int? warningDays) =>
        new(
            Guid.NewGuid(),
            userId,
            vehicleId,
            jobName,
            intervalKm,
            intervalMonths,
            warningKm,
            warningDays,
            null,
            true,
            DateTimeOffset.UtcNow);

    private static ServiceVisitListItem Visit(
        Guid userId,
        Guid vehicleId,
        DateOnly date,
        int odometerKm,
        string jobName)
    {
        var visitId = Guid.NewGuid();
        return new ServiceVisitListItem(
            visitId,
            vehicleId,
            userId,
            date,
            odometerKm,
            null,
            null,
            0.19m,
            0m,
            0m,
            0m,
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow,
            false,
            [
                new ServiceJobListItem(
                    Guid.NewGuid(),
                    visitId,
                    null,
                    jobName,
                    null,
                    1m,
                    0m,
                    0m,
                    null,
                    true,
                    DateTimeOffset.UtcNow,
                    DateTimeOffset.UtcNow),
            ]);
    }
}
