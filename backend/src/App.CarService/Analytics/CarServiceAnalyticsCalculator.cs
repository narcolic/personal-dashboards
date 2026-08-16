using PortfolioTerminal.CarService.Visits;

namespace PortfolioTerminal.CarService.Analytics;

public static class CarServiceAnalyticsCalculator
{
    public static CarServiceAnalyticsResult Calculate(
        IReadOnlyList<ServiceVisitListItem> visits,
        int currentYear) =>
        Calculate(visits, new DateOnly(currentYear, 12, 31), CarServiceAnalyticsPeriod.All);

    public static CarServiceAnalyticsResult Calculate(
        IReadOnlyList<ServiceVisitListItem> visits,
        DateOnly today,
        CarServiceAnalyticsPeriod period)
    {
        var totalLifetimeCost = visits.Sum(visit => visit.TotalAmount);
        var costThisYear = visits
            .Where(visit => visit.ServiceDate.Year == today.Year)
            .Sum(visit => visit.TotalAmount);
        var annualIntervals = visits
            .Where(visit => visit.IsAnnualService)
            .GroupBy(visit => visit.VehicleId)
            .SelectMany(group =>
            {
                var ordered = group.OrderBy(visit => visit.ServiceDate).ToArray();
                return ordered.Zip(ordered.Skip(1),
                    (previous, current) => current.OdometerKm - previous.OdometerKm);
            })
            .Where(interval => interval >= 0)
            .ToArray();
        var mostExpensiveVisit = visits
            .OrderByDescending(visit => visit.TotalAmount)
            .FirstOrDefault();
        var periodRange = GetPeriodRange(today, period);
        var selectedVisits = FilterVisits(visits, periodRange.Start, periodRange.End);
        var previousVisits = periodRange.PreviousStart is null || periodRange.PreviousEnd is null
            ? []
            : FilterVisits(visits, periodRange.PreviousStart, periodRange.PreviousEnd.Value);
        var selectedTotal = selectedVisits.Sum(visit => visit.TotalAmount);
        decimal? previousTotal = periodRange.PreviousStart is null
            ? null
            : previousVisits.Sum(visit => visit.TotalAmount);
        decimal? changePercent = previousTotal is > 0
            ? (selectedTotal - previousTotal.Value) / previousTotal.Value * 100
            : null;

        return new CarServiceAnalyticsResult(
            visits.Count,
            totalLifetimeCost,
            costThisYear,
            visits.Count == 0 ? null : visits.Max(visit => visit.ServiceDate),
            visits.Count == 0 ? null : visits.Max(visit => visit.OdometerKm),
            visits.Count == 0 ? 0 : totalLifetimeCost / visits.Count,
            annualIntervals.Length == 0 ? null : (decimal)annualIntervals.Average(),
            CalculateCostPer1000Km(visits),
            mostExpensiveVisit is null
                ? null
                : new MostExpensiveVisitResult(
                    mostExpensiveVisit.Id,
                    mostExpensiveVisit.ServiceDate,
                    mostExpensiveVisit.TotalAmount),
            CalculateAnnualSpend(visits),
            CalculateCategorySpend(selectedVisits),
            CalculateTopJobs(selectedVisits),
            new AnalyticsPeriodResult(
                period.ToKey(),
                periodRange.Start,
                periodRange.End,
                selectedVisits.Length,
                selectedTotal,
                selectedVisits.Length == 0 ? 0 : selectedTotal / selectedVisits.Length,
                CalculateCostPer1000Km(selectedVisits),
                previousTotal,
                changePercent),
            CalculateSpendTrend(selectedVisits, previousVisits, periodRange),
            [.. selectedVisits
                .OrderByDescending(visit => visit.TotalAmount)
                .ThenByDescending(visit => visit.ServiceDate)
                .Take(3)
                .Select(visit => new ExpensiveVisitResult(
                    visit.Id,
                    visit.VehicleId,
                    visit.ServiceDate,
                    visit.Workshop,
                    visit.TotalAmount))],
            [.. selectedVisits
                .GroupBy(visit => visit.VehicleId)
                .Select(group =>
                {
                    var vehicleVisits = group.ToArray();
                    var total = vehicleVisits.Sum(visit => visit.TotalAmount);
                    return new VehicleComparisonResult(
                        group.Key,
                        vehicleVisits.Length,
                        total,
                        total / vehicleVisits.Length,
                        CalculateCostPer1000Km(vehicleVisits));
                })
                .OrderByDescending(item => item.TotalSpend)]);
    }

    private static ServiceVisitListItem[] FilterVisits(
        IReadOnlyList<ServiceVisitListItem> visits,
        DateOnly? start,
        DateOnly end) =>
        [.. visits.Where(visit =>
            (start is null || visit.ServiceDate >= start.Value) && visit.ServiceDate <= end)];

    private static PeriodRange GetPeriodRange(DateOnly today, CarServiceAnalyticsPeriod period)
    {
        if (period == CarServiceAnalyticsPeriod.All)
        {
            return new PeriodRange(null, today, null, null);
        }

        var start = period switch
        {
            CarServiceAnalyticsPeriod.YearToDate => new DateOnly(today.Year, 1, 1),
            CarServiceAnalyticsPeriod.Last3Years => today.AddYears(-3).AddDays(1),
            _ => today.AddYears(-1).AddDays(1),
        };
        DateOnly previousStart;
        DateOnly previousEnd;

        if (period == CarServiceAnalyticsPeriod.YearToDate)
        {
            previousStart = new DateOnly(today.Year - 1, 1, 1);
            previousEnd = today.AddYears(-1);
        }
        else
        {
            var length = today.DayNumber - start.DayNumber + 1;
            previousEnd = start.AddDays(-1);
            previousStart = previousEnd.AddDays(-(length - 1));
        }

        return new PeriodRange(start, today, previousStart, previousEnd);
    }

    private static decimal? CalculateCostPer1000Km(IReadOnlyList<ServiceVisitListItem> visits)
    {
        var distance = visits
            .GroupBy(visit => visit.VehicleId)
            .Sum(group =>
            {
                var odometers = group.Select(visit => visit.OdometerKm).ToArray();
                return odometers.Length < 2 ? 0 : odometers.Max() - odometers.Min();
            });

        return distance <= 0 ? null : visits.Sum(visit => visit.TotalAmount) / distance * 1000;
    }

    private static SpendTrendResult[] CalculateSpendTrend(
        IReadOnlyList<ServiceVisitListItem> selectedVisits,
        IReadOnlyList<ServiceVisitListItem> previousVisits,
        PeriodRange range)
    {
        if (range.Start is null)
        {
            return [.. selectedVisits
                .GroupBy(visit => visit.ServiceDate.Year)
                .OrderBy(group => group.Key)
                .Select(group => new SpendTrendResult(
                    new DateOnly(group.Key, 1, 1),
                    group.Sum(visit => visit.TotalAmount),
                    null))];
        }

        var results = new List<SpendTrendResult>();
        var bucketStart = range.Start.Value;
        while (bucketStart <= range.End)
        {
            var nextMonth = new DateOnly(bucketStart.Year, bucketStart.Month, 1).AddMonths(1);
            var bucketEnd = nextMonth.AddDays(-1);
            if (bucketEnd > range.End)
            {
                bucketEnd = range.End;
            }

            var offsetStart = bucketStart.DayNumber - range.Start.Value.DayNumber;
            var offsetEnd = bucketEnd.DayNumber - range.Start.Value.DayNumber;
            var previousBucketStart = range.PreviousStart!.Value.AddDays(offsetStart);
            var previousBucketEnd = range.PreviousStart.Value.AddDays(offsetEnd);
            if (previousBucketEnd > range.PreviousEnd)
            {
                previousBucketEnd = range.PreviousEnd!.Value;
            }

            results.Add(new SpendTrendResult(
                bucketStart,
                selectedVisits
                    .Where(visit => visit.ServiceDate >= bucketStart && visit.ServiceDate <= bucketEnd)
                    .Sum(visit => visit.TotalAmount),
                previousVisits
                    .Where(visit =>
                        visit.ServiceDate >= previousBucketStart &&
                        visit.ServiceDate <= previousBucketEnd)
                    .Sum(visit => visit.TotalAmount)));

            bucketStart = bucketEnd.AddDays(1);
        }

        return [.. results];
    }

    private static AnnualSpendResult[] CalculateAnnualSpend(
        IReadOnlyList<ServiceVisitListItem> visits) =>
        [.. visits
            .GroupBy(visit => visit.ServiceDate.Year)
            .OrderBy(group => group.Key)
            .Select(group => new AnnualSpendResult(
                group.Key.ToString(System.Globalization.CultureInfo.InvariantCulture),
                group.Sum(visit => visit.TotalAmount)))];

    private static CategorySpendResult[] CalculateCategorySpend(
        IReadOnlyList<ServiceVisitListItem> visits)
    {
        var totals = new Dictionary<string, decimal>(StringComparer.Ordinal);
        foreach (var visit in visits)
        {
            foreach (var job in visit.Jobs)
            {
                var category = string.IsNullOrEmpty(job.CategorySnapshot)
                    ? "OTHER"
                    : job.CategorySnapshot.ToUpperInvariant();
                var lineIncludingVat = job.LineTotalExVat * (1 + visit.VatRate);
                totals[category] = totals.GetValueOrDefault(category) + lineIncludingVat;
            }
        }

        return [.. totals
            .Select(item => new CategorySpendResult(item.Key, item.Value))
            .OrderByDescending(item => item.Total)];
    }

    private static TopJobResult[] CalculateTopJobs(IReadOnlyList<ServiceVisitListItem> visits)
    {
        var totals = new Dictionary<string, (HashSet<Guid> VisitIds, decimal TotalSpent)>(
            StringComparer.Ordinal);
        foreach (var visit in visits)
        {
            foreach (var job in visit.Jobs)
            {
                var name = job.JobNameSnapshot.Trim();
                if (name.Length == 0)
                {
                    continue;
                }

                if (!totals.TryGetValue(name, out var current))
                {
                    current = ([], 0m);
                }

                current.VisitIds.Add(visit.Id);
                totals[name] = (
                    current.VisitIds,
                    current.TotalSpent + job.LineTotalExVat * (1 + visit.VatRate));
            }
        }

        return [.. totals
            .Select(item => new TopJobResult(
                item.Key,
                item.Value.VisitIds.Count,
                item.Value.TotalSpent))
            .OrderByDescending(item => item.Count)
            .ThenBy(item => item.JobName, StringComparer.Ordinal)
            .Take(10)];
    }

    private sealed record PeriodRange(
        DateOnly? Start,
        DateOnly End,
        DateOnly? PreviousStart,
        DateOnly? PreviousEnd);
}
