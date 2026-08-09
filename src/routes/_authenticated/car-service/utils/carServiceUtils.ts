import type { ServiceVisitWithJobs } from "@/routes/_authenticated/car-service/types";
import type { ServiceReminderStatusInfo } from "@/routes/_authenticated/car-service/types";

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

export function computeAnnualServiceStatus(
  visits: ServiceVisitWithJobs[],
  currentOdometerKm: number,
  intervalKm: number,
  intervalMonths: number,
): ServiceReminderStatusInfo {
  const annualVisits = visits
    .filter((visit) => visit.is_annual_service)
    .slice()
    .sort((a, b) => new Date(b.service_date).getTime() - new Date(a.service_date).getTime());

  const latestAnnualVisit = annualVisits[0];
  if (!latestAnnualVisit) {
    return {
      status: "NO DATA",
      lastDoneDate: null,
      lastDoneKm: null,
      kmRemaining: null,
      daysRemaining: null,
    };
  }

  const today = new Date();
  const lastDoneDate = new Date(latestAnnualVisit.service_date);
  const lastDoneKm = Number(latestAnnualVisit.odometer_km);
  const kmSinceLast = currentOdometerKm - lastDoneKm;

  const due = new Date(lastDoneDate);
  due.setMonth(due.getMonth() + intervalMonths);
  const daysRemaining = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const kmRemaining = Math.max(0, intervalKm - kmSinceLast);

  if (kmSinceLast >= intervalKm || daysRemaining <= 0) {
    return {
      status: "OVERDUE",
      lastDoneDate: latestAnnualVisit.service_date,
      lastDoneKm,
      kmRemaining,
      daysRemaining,
    };
  }

  if (kmRemaining <= 500 || daysRemaining <= 30) {
    return {
      status: "DUE SOON",
      lastDoneDate: latestAnnualVisit.service_date,
      lastDoneKm,
      kmRemaining,
      daysRemaining,
    };
  }

  return {
    status: "OK",
    lastDoneDate: latestAnnualVisit.service_date,
    lastDoneKm,
    kmRemaining,
    daysRemaining,
  };
}
