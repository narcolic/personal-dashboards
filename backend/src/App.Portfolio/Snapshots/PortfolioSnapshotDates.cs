using System.Globalization;
using System.Text.Json;

namespace PortfolioTerminal.Portfolio.Snapshots;

public static class PortfolioSnapshotDates
{
    private static readonly TimeZoneInfo AthensTimeZone =
        TimeZoneInfo.FindSystemTimeZoneById("Europe/Athens");

    public static DateOnly ValuationDate(DateOnly captureDate, DateTimeOffset capturedAt, JsonElement metadata)
    {
        if (metadata.ValueKind == JsonValueKind.Object &&
            metadata.TryGetProperty("valuationDate", out var value) &&
            value.ValueKind == JsonValueKind.String &&
            DateOnly.TryParseExact(value.GetString(), "yyyy-MM-dd", CultureInfo.InvariantCulture,
                DateTimeStyles.None, out var valuationDate))
            return valuationDate;

        // Legacy scheduled snapshots use the new day's date at Athens midnight.
        // Explicit backfills and daytime captures already have their intended date.
        var local = TimeZoneInfo.ConvertTime(capturedAt, AthensTimeZone);
        return local.Hour == 0 && captureDate == DateOnly.FromDateTime(local.DateTime)
            ? captureDate.AddDays(-1)
            : captureDate;
    }
}
