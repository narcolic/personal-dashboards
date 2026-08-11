using PortfolioTerminal.CarService.Visits;

namespace PortfolioTerminal.CarService.Analytics;

public static class CarServiceAnalyticsCalculator
{
    public static CarServiceAnalyticsResult Calculate(
        IReadOnlyList<ServiceVisitListItem> visits,
        int currentYear)
    {
        var totalLifetimeCost = visits.Sum(visit => visit.TotalAmount);
        var costThisYear = visits
            .Where(visit => visit.ServiceDate.Year == currentYear)
            .Sum(visit => visit.TotalAmount);
        var annualVisits = visits
            .Where(visit => visit.IsAnnualService)
            .OrderBy(visit => visit.ServiceDate)
            .ToArray();
        var intervals = annualVisits
            .Zip(annualVisits.Skip(1), (previous, current) =>
                current.OdometerKm - previous.OdometerKm)
            .Where(interval => interval >= 0)
            .ToArray();
        var kmRange = visits.Count < 2
            ? 0
            : visits.Max(visit => visit.OdometerKm) - visits.Min(visit => visit.OdometerKm);
        var mostExpensiveVisit = visits
            .OrderByDescending(visit => visit.TotalAmount)
            .FirstOrDefault();

        return new CarServiceAnalyticsResult(
            visits.Count,
            totalLifetimeCost,
            costThisYear,
            visits.Count == 0 ? null : visits.Max(visit => visit.ServiceDate),
            visits.Count == 0 ? null : visits.Max(visit => visit.OdometerKm),
            visits.Count == 0 ? 0 : totalLifetimeCost / visits.Count,
            intervals.Length == 0 ? null : (decimal)intervals.Sum() / intervals.Length,
            kmRange <= 0 ? null : totalLifetimeCost / kmRange * 1000,
            mostExpensiveVisit is null
                ? null
                : new MostExpensiveVisitResult(
                    mostExpensiveVisit.Id,
                    mostExpensiveVisit.ServiceDate,
                    mostExpensiveVisit.TotalAmount),
            CalculateAnnualSpend(visits),
            CalculateCategorySpend(visits),
            CalculateTopJobs(visits));
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

    private static TopJobResult[] CalculateTopJobs(
        IReadOnlyList<ServiceVisitListItem> visits)
    {
        var totals = new Dictionary<string, (int Count, decimal TotalSpent)>(
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

                var current = totals.GetValueOrDefault(name);
                totals[name] = (
                    current.Count + 1,
                    current.TotalSpent + job.LineTotalExVat * (1 + visit.VatRate));
            }
        }

        return [.. totals
            .Select(item => new TopJobResult(
                item.Key,
                item.Value.Count,
                item.Value.TotalSpent))
            .OrderByDescending(item => item.Count)
            .ThenBy(item => item.JobName, StringComparer.Ordinal)
            .Take(10)];
    }
}
