import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";

export type Person = { id: string; name: string; isActive: boolean };
export type Member = {
  personId: string;
  paymentBehavior: "manual" | "auto";
  fixedAmount: number | null;
};
export type Subscription = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  notes: string | null;
  logoKey: string | null;
  amount: number;
  currency: string;
  intervalMonths: number;
  nextBillingDate: string;
  billingAnchorDay: number;
  splitMode: "equal" | "fixed";
  isActive: boolean;
  members: Member[];
};
export type Contribution = {
  id: string;
  personId: string;
  amount: number;
  paymentBehavior: "manual" | "auto";
  status: "unpaid" | "paid" | "auto_received";
  paidAt: string | null;
};
export type Period = {
  id: string;
  subscriptionId: string;
  billingDate: string;
  fullAmount: number;
  myAmount: number;
  currency: string;
  contributions: Contribution[];
};
export type SubscriptionInput = Omit<Subscription, "id" | "billingAnchorDay"> & {
  trackCurrentPeriod: boolean;
};
export type TrackerOverview = {
  state: {
    homeCurrency: string;
    people: Person[];
    subscriptions: Subscription[];
    periods: Period[];
  };
  fx: { base: string; asOf: string | null; rates: Record<string, number> };
  summary: {
    activeCount: number;
    myMonthly: number | null;
    myAnnual: number | null;
    fullMonthly: number | null;
    fullAnnual: number | null;
    outstanding: number | null;
  };
};

export const trackerKey = ["subscriptions", "overview"] as const;

export function useTracker() {
  return useQuery({
    queryKey: trackerKey,
    queryFn: ({ signal }) => apiFetch<TrackerOverview>("/api/subscriptions/overview", { signal }),
    staleTime: 30_000,
  });
}

export function useRefreshTracker() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: trackerKey });
}

export async function saveSubscription(input: SubscriptionInput, id?: string) {
  return apiFetch<{ id: string }>(
    id ? `/api/subscriptions/${encodeURIComponent(id)}` : "/api/subscriptions",
    {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function savePerson(name: string, isActive = true, id?: string) {
  return apiFetch<{ id: string }>(
    id ? `/api/subscriptions/people/${encodeURIComponent(id)}` : "/api/subscriptions/people",
    {
      method: id ? "PUT" : "POST",
      body: JSON.stringify({ name, isActive }),
    },
  );
}

export async function saveHomeCurrency(homeCurrency: string) {
  return apiFetch<{ homeCurrency: string }>("/api/subscriptions/settings", {
    method: "PUT",
    body: JSON.stringify({ homeCurrency }),
  });
}

export async function setContributionPaid(id: string, paid: boolean) {
  return apiFetch<void>(`/api/subscriptions/contributions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ paid }),
  });
}

export function money(amount: number | null | undefined, currency: string): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function convert(
  amount: number,
  currency: string,
  overview: TrackerOverview,
): number | null {
  const rate = overview.fx.rates[currency];
  return rate && Number.isFinite(rate) && rate > 0 ? amount / rate : null;
}

export function myShare(subscription: Subscription): number {
  if (subscription.splitMode === "fixed") {
    return Math.max(
      0,
      subscription.amount -
        subscription.members.reduce((sum, member) => sum + (member.fixedAmount ?? 0), 0),
    );
  }
  const memberShare =
    Math.floor(Math.round(subscription.amount * 100) / (subscription.members.length + 1)) / 100;
  return Math.round((subscription.amount - memberShare * subscription.members.length) * 100) / 100;
}

export function memberShare(subscription: Subscription, member: Member): number {
  if (subscription.splitMode === "fixed") return member.fixedAmount ?? 0;
  return (
    Math.floor(Math.round(subscription.amount * 100) / (subscription.members.length + 1)) / 100
  );
}
