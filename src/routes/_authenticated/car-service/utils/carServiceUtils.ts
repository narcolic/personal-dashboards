import type { ServiceVisitWithJobs } from "@/routes/_authenticated/car-service/types";

export function getTotalLifetimeCost(visits: ServiceVisitWithJobs[]): number {
  return visits.reduce((sum, visit) => sum + Number(visit.total_amount ?? 0), 0);
}

export function getCostThisYear(visits: ServiceVisitWithJobs[]): number {
  const year = new Date().getFullYear();
  return visits
    .filter((visit) => new Date(visit.service_date).getFullYear() === year)
    .reduce((sum, visit) => sum + Number(visit.total_amount ?? 0), 0);
}

export function getLastVisit(visits: ServiceVisitWithJobs[]): ServiceVisitWithJobs | null {
  if (visits.length === 0) return null;
  return (
    visits
      .slice()
      .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime())[0] ??
    null
  );
}

export function getTotalVisits(visits: ServiceVisitWithJobs[]): number {
  return visits.length;
}

export function getAnnualSpend(visits: ServiceVisitWithJobs[]): { year: string; total: number }[] {
  const map = new Map<string, number>();
  for (const visit of visits) {
    const year = String(new Date(visit.service_date).getFullYear());
    map.set(year, (map.get(year) ?? 0) + Number(visit.total_amount ?? 0));
  }
  return Array.from(map, ([year, total]) => ({ year, total })).sort(
    (a, b) => Number(a.year) - Number(b.year),
  );
}

export function getSpendByCategory(
  visits: ServiceVisitWithJobs[],
): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const visit of visits) {
    for (const job of visit.jobs) {
      const category = (job.category_snapshot || "OTHER").toUpperCase();
      const lineInclVat = Number(job.line_total_ex_vat ?? 0) * (1 + Number(visit.vat_rate ?? 0));
      map.set(category, (map.get(category) ?? 0) + lineInclVat);
    }
  }
  return Array.from(map, ([category, total]) => ({ category, total })).sort(
    (a, b) => b.total - a.total,
  );
}

export function getJobFrequency(
  visits: ServiceVisitWithJobs[],
): { jobName: string; count: number }[] {
  const map = new Map<string, number>();
  for (const visit of visits) {
    for (const job of visit.jobs) {
      const name = job.job_name_snapshot.trim();
      if (!name) continue;
      map.set(name, (map.get(name) ?? 0) + 1);
    }
  }
  return Array.from(map, ([jobName, count]) => ({ jobName, count }))
    .sort((a, b) => b.count - a.count || a.jobName.localeCompare(b.jobName))
    .slice(0, 10);
}

export function getAverageVisitCost(visits: ServiceVisitWithJobs[]): number {
  if (visits.length === 0) return 0;
  return getTotalLifetimeCost(visits) / visits.length;
}

export function getAverageKmInterval(visits: ServiceVisitWithJobs[]): number | null {
  if (visits.length < 2) return null;
  const sorted = visits
    .slice()
    .sort((a, b) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime());

  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const diff = Number(sorted[i].odometer_km) - Number(sorted[i - 1].odometer_km);
    if (diff >= 0) intervals.push(diff);
  }

  if (intervals.length === 0) return null;
  return intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
}

export function getMostExpensiveVisit(visits: ServiceVisitWithJobs[]): ServiceVisitWithJobs | null {
  if (visits.length === 0) return null;
  return visits.slice().sort((a, b) => Number(b.total_amount) - Number(a.total_amount))[0] ?? null;
}

export function getCostPer1000km(visits: ServiceVisitWithJobs[]): number | null {
  if (visits.length < 2) return null;
  const kms = visits
    .map((visit) => Number(visit.odometer_km))
    .filter((value) => Number.isFinite(value));
  if (kms.length < 2) return null;
  const kmRange = Math.max(...kms) - Math.min(...kms);
  if (kmRange <= 0) return null;
  return (getTotalLifetimeCost(visits) / kmRange) * 1000;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-GB");
}

export function formatKm(km: number): string {
  return `${new Intl.NumberFormat("en-US").format(km)} km`;
}
