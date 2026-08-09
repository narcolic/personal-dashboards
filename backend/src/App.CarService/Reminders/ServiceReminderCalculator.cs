using PortfolioTerminal.CarService.Visits;

namespace PortfolioTerminal.CarService.Reminders;

public static class ServiceReminderCalculator
{
    public static IReadOnlyList<ServiceReminderWithStatus> Calculate(
        IReadOnlyList<ServiceReminderListItem> reminders,
        ServiceVisitListItem[] visits,
        DateTimeOffset now,
        bool useLatestVisitOdometer)
    {
        var visitsByVehicle = visits
            .GroupBy(visit => visit.VehicleId)
            .ToDictionary(group => group.Key, group => group.ToArray());

        return reminders
            .Select(reminder => CalculateOne(
                reminder,
                visitsByVehicle.GetValueOrDefault(reminder.VehicleId) ?? [],
                now,
                useLatestVisitOdometer))
            .ToArray();
    }

    private static ServiceReminderWithStatus CalculateOne(
        ServiceReminderListItem reminder,
        ServiceVisitListItem[] visits,
        DateTimeOffset now,
        bool useLatestVisitOdometer)
    {
        var currentOdometerKm = visits.Length == 0
            ? 0
            : useLatestVisitOdometer
                ? visits.OrderByDescending(visit => visit.ServiceDate).First().OdometerKm
                : visits.Max(visit => visit.OdometerKm);
        var matchingVisit = visits
            .OrderByDescending(visit => visit.ServiceDate)
            .FirstOrDefault(visit => visit.Jobs.Any(job =>
                string.Equals(
                    job.JobNameSnapshot.Trim(),
                    reminder.JobName.Trim(),
                    StringComparison.OrdinalIgnoreCase)));

        if (matchingVisit is null)
        {
            return WithStatus(reminder, "NO DATA", null, null, null, null);
        }

        var lastDoneKm = matchingVisit.OdometerKm;
        var kmSinceLast = currentOdometerKm - lastDoneKm;
        var monthsSinceLast =
            (now.Year - matchingVisit.ServiceDate.Year) * 12
            + now.Month - matchingVisit.ServiceDate.Month;
        int? kmRemaining = reminder.IntervalKm is null
            ? null
            : Math.Max(0, reminder.IntervalKm.Value - kmSinceLast);
        int? daysRemaining = null;

        if (reminder.IntervalMonths is not null)
        {
            var due = AddMonthsWithJavaScriptOverflow(
                matchingVisit.ServiceDate,
                reminder.IntervalMonths.Value);
            daysRemaining = (int)Math.Ceiling((due - now).TotalDays);
        }

        var overdue =
            (reminder.IntervalKm is not null && kmSinceLast >= reminder.IntervalKm)
            || (reminder.IntervalMonths is not null
                && monthsSinceLast >= reminder.IntervalMonths);
        if (overdue)
        {
            return WithStatus(
                reminder,
                "OVERDUE",
                matchingVisit.ServiceDate,
                lastDoneKm,
                kmRemaining,
                daysRemaining);
        }

        var dueSoon =
            (reminder.IntervalKm is not null
                && reminder.WarningKm is not null
                && kmSinceLast >= reminder.IntervalKm - reminder.WarningKm)
            || (daysRemaining is not null
                && reminder.WarningDays is not null
                && daysRemaining <= reminder.WarningDays);

        return WithStatus(
            reminder,
            dueSoon ? "DUE SOON" : "OK",
            matchingVisit.ServiceDate,
            lastDoneKm,
            kmRemaining,
            daysRemaining);
    }

    private static DateTimeOffset AddMonthsWithJavaScriptOverflow(
        DateOnly date,
        int months) =>
        new DateTimeOffset(date.Year, date.Month, 1, 0, 0, 0, TimeSpan.Zero)
            .AddMonths(months)
            .AddDays(date.Day - 1);

    private static ServiceReminderWithStatus WithStatus(
        ServiceReminderListItem reminder,
        string status,
        DateOnly? lastDoneDate,
        int? lastDoneKm,
        int? kmRemaining,
        int? daysRemaining) =>
        new(
            reminder.Id,
            reminder.UserId,
            reminder.VehicleId,
            reminder.JobName,
            reminder.IntervalKm,
            reminder.IntervalMonths,
            reminder.WarningKm,
            reminder.WarningDays,
            reminder.Notes,
            reminder.IsActive,
            reminder.CreatedAt,
            status,
            lastDoneDate,
            lastDoneKm,
            kmRemaining,
            daysRemaining);
}
