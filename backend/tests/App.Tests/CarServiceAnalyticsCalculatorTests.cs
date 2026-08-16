using PortfolioTerminal.CarService.Analytics;
using PortfolioTerminal.CarService.Visits;

namespace PortfolioTerminal.Tests;

public sealed class CarServiceAnalyticsCalculatorTests
{
    [Fact]
    public void CalculatePreservesExistingCarServiceAnalyticsRules()
    {
        var userId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var timestamp = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var visits = new[]
        {
            Visit(
                Guid.NewGuid(), vehicleId, userId, new DateOnly(2026, 6, 1),
                20_000, 0.20m, 300m, true, timestamp,
                Job("Oil change", "SERVICE", 100m, timestamp),
                Job("Tyres", "TYRES", 50m, timestamp)),
            Visit(
                Guid.NewGuid(), vehicleId, userId, new DateOnly(2026, 1, 1),
                15_000, 0.20m, 200m, true, timestamp,
                Job("Oil change", "SERVICE", 80m, timestamp)),
            Visit(
                Guid.NewGuid(), vehicleId, userId, new DateOnly(2025, 1, 1),
                10_000, 0.10m, 100m, false, timestamp,
                Job("Inspection", null, 20m, timestamp)),
        };

        var result = CarServiceAnalyticsCalculator.Calculate(visits, 2026);

        Assert.Equal(3, result.VisitCount);
        Assert.Equal(600m, result.TotalLifetimeCost);
        Assert.Equal(500m, result.CostThisYear);
        Assert.Equal(new DateOnly(2026, 6, 1), result.LastVisitDate);
        Assert.Equal(20_000, result.LatestOdometerKm);
        Assert.Equal(200m, result.AverageVisitCost);
        Assert.Equal(5_000m, result.AverageKmInterval);
        Assert.Equal(60m, result.CostPer1000Km);
        Assert.Equal(300m, result.MostExpensiveVisit?.TotalAmount);
        Assert.Equal("all", result.Period.Key);
        Assert.Equal(600m, result.Period.TotalSpend);

        Assert.Collection(
            result.AnnualSpend,
            item =>
            {
                Assert.Equal("2025", item.Year);
                Assert.Equal(100m, item.Total);
            },
            item =>
            {
                Assert.Equal("2026", item.Year);
                Assert.Equal(500m, item.Total);
            });
        Assert.Collection(
            result.CategorySpend,
            item =>
            {
                Assert.Equal("SERVICE", item.Category);
                Assert.Equal(216m, item.Total);
            },
            item =>
            {
                Assert.Equal("TYRES", item.Category);
                Assert.Equal(60m, item.Total);
            },
            item =>
            {
                Assert.Equal("OTHER", item.Category);
                Assert.Equal(22m, item.Total);
            });
        Assert.Collection(
            result.TopJobs,
            item =>
            {
                Assert.Equal("Oil change", item.JobName);
                Assert.Equal(2, item.Count);
                Assert.Equal(216m, item.TotalSpent);
            },
            item => Assert.Equal("Inspection", item.JobName),
            item => Assert.Equal("Tyres", item.JobName));
    }

    [Fact]
    public void CalculateReturnsZeroAndNullDefaultsForNoVisits()
    {
        var result = CarServiceAnalyticsCalculator.Calculate([], 2026);

        Assert.Equal(0, result.VisitCount);
        Assert.Equal(0m, result.TotalLifetimeCost);
        Assert.Equal(0m, result.AverageVisitCost);
        Assert.Null(result.LastVisitDate);
        Assert.Null(result.LatestOdometerKm);
        Assert.Null(result.AverageKmInterval);
        Assert.Null(result.CostPer1000Km);
        Assert.Null(result.MostExpensiveVisit);
        Assert.Empty(result.AnnualSpend);
        Assert.Empty(result.CategorySpend);
        Assert.Empty(result.TopJobs);
    }

    [Fact]
    public void CalculateFiltersLastTwelveMonthsAndComparesPreviousPeriod()
    {
        var userId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var timestamp = DateTimeOffset.UtcNow;
        var visits = new[]
        {
            Visit(Guid.NewGuid(), vehicleId, userId, new DateOnly(2026, 8, 10), 30_000,
                0m, 200m, false, timestamp, Job("Tyres", "TYRES", 200m, timestamp)),
            Visit(Guid.NewGuid(), vehicleId, userId, new DateOnly(2025, 8, 20), 20_000,
                0m, 100m, false, timestamp, Job("Oil", "SERVICE", 100m, timestamp)),
            Visit(Guid.NewGuid(), vehicleId, userId, new DateOnly(2025, 8, 1), 15_000,
                0m, 50m, false, timestamp, Job("Inspection", "OTHER", 50m, timestamp)),
        };

        var result = CarServiceAnalyticsCalculator.Calculate(
            visits,
            new DateOnly(2026, 8, 16),
            CarServiceAnalyticsPeriod.Last12Months);

        Assert.Equal(new DateOnly(2025, 8, 17), result.Period.StartDate);
        Assert.Equal(2, result.Period.VisitCount);
        Assert.Equal(300m, result.Period.TotalSpend);
        Assert.Equal(50m, result.Period.PreviousTotalSpend);
        Assert.Equal(500m, result.Period.SpendChangePercent);
        Assert.Equal(2, result.ExpensiveVisits.Count);
        Assert.DoesNotContain(result.CategorySpend, item => item.Category == "OTHER");
        Assert.Contains(result.SpendTrend, item => item.PreviousTotal == 50m);
    }

    [Fact]
    public void CalculateUsesEquivalentPriorYearForYearToDate()
    {
        var userId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var timestamp = DateTimeOffset.UtcNow;
        var visits = new[]
        {
            Visit(Guid.NewGuid(), vehicleId, userId, new DateOnly(2026, 2, 1), 20_000,
                0m, 150m, false, timestamp),
            Visit(Guid.NewGuid(), vehicleId, userId, new DateOnly(2025, 2, 1), 10_000,
                0m, 100m, false, timestamp),
            Visit(Guid.NewGuid(), vehicleId, userId, new DateOnly(2025, 12, 1), 15_000,
                0m, 999m, false, timestamp),
        };

        var result = CarServiceAnalyticsCalculator.Calculate(
            visits,
            new DateOnly(2026, 8, 16),
            CarServiceAnalyticsPeriod.YearToDate);

        Assert.Equal(150m, result.Period.TotalSpend);
        Assert.Equal(100m, result.Period.PreviousTotalSpend);
        Assert.Equal(50m, result.Period.SpendChangePercent);
    }

    [Fact]
    public void CalculateAggregatesDistanceWithinEachVehicle()
    {
        var userId = Guid.NewGuid();
        var firstVehicle = Guid.NewGuid();
        var secondVehicle = Guid.NewGuid();
        var timestamp = DateTimeOffset.UtcNow;
        var visits = new[]
        {
            Visit(Guid.NewGuid(), firstVehicle, userId, new DateOnly(2026, 1, 1), 10_000,
                0m, 100m, false, timestamp),
            Visit(Guid.NewGuid(), firstVehicle, userId, new DateOnly(2026, 6, 1), 20_000,
                0m, 100m, false, timestamp),
            Visit(Guid.NewGuid(), secondVehicle, userId, new DateOnly(2026, 1, 1), 100_000,
                0m, 100m, false, timestamp),
            Visit(Guid.NewGuid(), secondVehicle, userId, new DateOnly(2026, 6, 1), 120_000,
                0m, 100m, false, timestamp),
        };

        var result = CarServiceAnalyticsCalculator.Calculate(visits, 2026);

        Assert.Equal(400m / 30_000m * 1000m, result.CostPer1000Km);
        Assert.Equal(2, result.VehicleComparison.Count);
    }

    [Fact]
    public void CalculateReturnsNullChangeWhenPreviousPeriodHasNoSpend()
    {
        var timestamp = DateTimeOffset.UtcNow;
        var visits = new[]
        {
            Visit(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), new DateOnly(2026, 7, 1),
                10_000, 0m, 100m, false, timestamp),
        };

        var result = CarServiceAnalyticsCalculator.Calculate(
            visits,
            new DateOnly(2026, 8, 16),
            CarServiceAnalyticsPeriod.Last12Months);

        Assert.Equal(0m, result.Period.PreviousTotalSpend);
        Assert.Null(result.Period.SpendChangePercent);
        Assert.Null(result.Period.CostPer1000Km);
    }

    [Fact]
    public void CalculateTopJobsCountsDistinctVisitsInsteadOfJobLines()
    {
        var userId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        var timestamp = DateTimeOffset.UtcNow;
        var visits = new[]
        {
            Visit(
                Guid.NewGuid(), vehicleId, userId, new DateOnly(2026, 8, 1),
                10_000, 0m, 75m, false, timestamp,
                Job("Oil change", "SERVICE", 25m, timestamp),
                Job("Oil change", "SERVICE", 50m, timestamp)),
            Visit(
                Guid.NewGuid(), vehicleId, userId, new DateOnly(2026, 8, 10),
                11_000, 0m, 40m, false, timestamp,
                Job("Oil change", "SERVICE", 40m, timestamp)),
        };

        var result = CarServiceAnalyticsCalculator.Calculate(visits, 2026);

        var oilChange = Assert.Single(result.TopJobs);
        Assert.Equal("Oil change", oilChange.JobName);
        Assert.Equal(2, oilChange.Count);
        Assert.Equal(115m, oilChange.TotalSpent);
    }

    private static ServiceVisitListItem Visit(
        Guid id,
        Guid vehicleId,
        Guid userId,
        DateOnly serviceDate,
        int odometerKm,
        decimal vatRate,
        decimal totalAmount,
        bool isAnnualService,
        DateTimeOffset timestamp,
        params ServiceJobListItem[] jobs) =>
        new(
            id,
            vehicleId,
            userId,
            serviceDate,
            odometerKm,
            null,
            null,
            vatRate,
            totalAmount / (1 + vatRate),
            totalAmount - totalAmount / (1 + vatRate),
            totalAmount,
            timestamp,
            timestamp,
            isAnnualService,
            jobs);

    private static ServiceJobListItem Job(
        string name,
        string? category,
        decimal lineTotal,
        DateTimeOffset timestamp) =>
        new(
            Guid.NewGuid(),
            Guid.NewGuid(),
            null,
            name,
            category,
            1m,
            lineTotal,
            lineTotal,
            null,
            true,
            timestamp,
            timestamp);
}
