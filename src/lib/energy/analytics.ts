import { cents, type EnergyBill } from "./types.ts";

const DAY = 86400000;
export function billYears(bills: EnergyBill[]): number[] {
  const years = new Set<number>();
  for (const { summary: bill } of bills) {
    years.add(Number(bill.issueDate.slice(0, 4)));
    for (
      let year = Number(bill.periodStart.slice(0, 4));
      year <= Number(bill.periodEnd.slice(0, 4));
      year++
    )
      years.add(year);
  }
  return [...years].sort((a, b) => b - a);
}

/** Endpoints are inclusive for day allocation. The provider's reported billing-day count
 * is preserved separately; allocation is always labelled as an estimate. Actual readings
 * supersede overlapping estimates for the same supply; newer invoices resolve overlaps. */
export function energyAnalytics(bills: EnergyBill[], year: number) {
  const months = Array.from({ length: 12 }, (_, month) => ({
    month,
    cost: null as number | null,
    kwh: null as number | null,
    estimatedKwh: 0,
    days: 0,
    count: 0,
  }));
  const breakdown = {
    supplyCharges: 0,
    regulatedCharges: 0,
    taxes: 0,
    thirdPartyCharges: 0,
    adjustment: 0,
  };
  const issued = bills.filter((bill) => Number(bill.summary.issueDate.slice(0, 4)) === year);
  for (const { summary: bill } of issued) {
    const month = months[Number(bill.issueDate.slice(5, 7)) - 1];
    month.cost = ((month.cost == null ? 0 : cents(month.cost)) + cents(bill.currentTotal)) / 100;
    month.count++;
    for (const key of Object.keys(breakdown) as (keyof typeof breakdown)[])
      breakdown[key] = (cents(breakdown[key]) + cents(bill[key])) / 100;
  }
  const days = new Map<string, { month: number; kwh: number; estimated: boolean }>();
  const sorted = [...bills].sort(
    (a, b) =>
      Number(a.summary.billType === "actual") - Number(b.summary.billType === "actual") ||
      a.summary.issueDate.localeCompare(b.summary.issueDate) ||
      a.id.localeCompare(b.id),
  );
  const startOfYear = Date.UTC(year, 0, 1);
  const endOfYear = Date.UTC(year + 1, 0, 1);
  for (const { summary: bill } of sorted) {
    const start = Date.parse(bill.periodStart + "T00:00:00Z");
    const end = Date.parse(bill.periodEnd + "T00:00:00Z");
    const daily = bill.kwh / ((end - start) / DAY + 1);
    for (let time = Math.max(start, startOfYear); time <= end && time < endOfYear; time += DAY) {
      days.set(`${bill.supplyNumber.trim().replace(/[\s-]/g, "")}:${time}`, {
        month: new Date(time).getUTCMonth(),
        kwh: daily,
        estimated: bill.billType === "estimated",
      });
    }
  }
  const covered = new Set<string>();
  for (const [key, day] of days) {
    const month = months[day.month];
    month.kwh = (month.kwh ?? 0) + day.kwh;
    if (day.estimated) month.estimatedKwh += day.kwh;
    // Calendar coverage is a union, even with multiple supplies.
    covered.add(key.slice(key.lastIndexOf(":") + 1));
  }
  for (const key of covered) months[new Date(Number(key)).getUTCMonth()].days++;
  const recordedMonths = months.filter((month) => month.cost != null).length;
  const totalCost = issued.reduce((sum, bill) => sum + cents(bill.summary.currentTotal), 0) / 100;
  return {
    months,
    breakdown,
    issued,
    totalCost,
    totalKwh: months.reduce((sum, month) => sum + (month.kwh ?? 0), 0),
    averageMonthly: recordedMonths ? totalCost / recordedMonths : null,
    recordedMonths,
    coveredDays: covered.size,
    totalDays: (endOfYear - startOfYear) / DAY,
    estimatedKwh: months.reduce((sum, month) => sum + month.estimatedKwh, 0),
    averageDailyKwh: days.size
      ? months.reduce((sum, month) => sum + (month.kwh ?? 0), 0) / days.size
      : null,
  };
}
