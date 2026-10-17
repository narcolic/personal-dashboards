type SessionQuote = { regularMarketTime?: number };

const reportingDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Athens",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function calendarDate(now: Date) {
  const parts = reportingDayFormatter.formatToParts(now);
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)?.value)
    .join("-");
}

export function isTodayClosingSnapshot(
  snapshot: { snapshot_date: string; snapshot_at: string },
  now: Date,
) {
  const today = calendarDate(now);
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return (
    snapshot.snapshot_date === yesterday.toISOString().slice(0, 10) &&
    calendarDate(new Date(snapshot.snapshot_at)) === today
  );
}

export function isPreviousQuoteSession(quote: SessionQuote | undefined, now: Date) {
  if (!quote?.regularMarketTime || !Number.isFinite(quote.regularMarketTime)) return false;
  try {
    return calendarDate(new Date(quote.regularMarketTime * 1000)) < calendarDate(now);
  } catch {
    return false;
  }
}

export function calculateDailyChange({
  totalValue,
  quoteDayChange,
  closingSnapshotValue,
  externalFlow,
  quotes,
  now,
}: {
  totalValue: number;
  quoteDayChange: number;
  closingSnapshotValue: number | null;
  externalFlow: number;
  quotes: readonly (SessionQuote | undefined)[];
  now: Date;
}) {
  // A closed session from a previous date is not movement today. A session
  // that closed today still contributes its full day's performance.
  if (quotes.length > 0 && quotes.every((quote) => isPreviousQuoteSession(quote, now))) {
    return { change: 0, baseline: totalValue };
  }
  return {
    change:
      closingSnapshotValue === null
        ? quoteDayChange
        : totalValue - closingSnapshotValue - externalFlow,
    baseline: closingSnapshotValue ?? totalValue - quoteDayChange,
  };
}
