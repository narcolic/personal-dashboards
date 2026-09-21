import { createFileRoute, Link } from "@tanstack/react-router";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { SubscriptionLogo } from "@/components/subscriptions/SubscriptionLogo";
import { convert, memberShare, money, myShare, useTracker } from "@/lib/subscriptions";
import { billingDate, LoadingState, PageHeading } from "./components";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/subscriptions/")({
  component: SubscriptionOverview,
});

function SubscriptionOverview() {
  const { t } = useTranslation();
  const tracker = useTracker();
  if (!tracker.data) return <LoadingState loading={tracker.isPending} error={tracker.error} />;
  const data = tracker.data;
  const { state, summary } = data;
  const currency = state.homeCurrency;
  const active = state.subscriptions.filter((s) => s.isActive);
  const upcoming = [...active]
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate))
    .slice(0, 6);
  const categoryMap = new Map<string, number | null>();
  for (const subscription of active) {
    const category = subscription.category?.trim() || t("subscriptions.uncategorized");
    const value = convert(
      myShare(subscription) / subscription.intervalMonths,
      subscription.currency,
      data,
    );
    const old = categoryMap.get(category);
    categoryMap.set(category, value === null || old === null ? null : (old ?? 0) + value);
  }
  const unpaidContributions = state.periods
    .flatMap((p) => p.contributions)
    .filter((c) => c.status === "unpaid");
  const unpaidCount = unpaidContributions.length;
  const hasOutstanding =
    unpaidContributions.some((contribution) => contribution.amount > 0) ||
    (summary.outstanding ?? 0) > 0;

  return (
    <div className="space-y-5">
      <PageHeading
        title={t("dashboards.subscriptionsTitle")}
        action={{ to: "/subscriptions/new", label: t("subscriptions.add") }}
      />
      {active.length === 0 && (
        <TerminalCard>
          <p className="text-sm text-muted-foreground">{t("subscriptions.empty")}</p>
        </TerminalCard>
      )}
      <TerminalCard bodyClassName="p-0">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.55fr)]">
          <div className="border-b border-border/60 p-5 md:p-6 lg:border-b-0 lg:border-r">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {t("subscriptions.myMonthly")}
            </p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-primary md:text-5xl">
              {money(summary.myMonthly, currency)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{t("subscriptions.myShareHint")}</p>
            <p className="mt-6 text-sm text-muted-foreground">
              {t("subscriptions.myAnnual")}:{" "}
              <strong className="font-semibold text-foreground">
                {money(summary.myAnnual, currency)}
              </strong>
            </p>
          </div>
          <div className="flex flex-col justify-between gap-5 p-5 md:p-6">
            <Link
              to="/subscriptions/owed"
              className="group rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span className="block text-xs uppercase tracking-[0.14em] text-muted-foreground group-hover:text-foreground">
                {t("subscriptions.outstanding")}
              </span>
              <strong
                className={`mt-2 block text-2xl font-bold ${hasOutstanding ? "text-destructive" : "text-foreground"}`}
              >
                {money(summary.outstanding, currency)}
              </strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                {unpaidCount} {t("subscriptions.unpaidContributions")}
              </span>
            </Link>
            <p className="border-t border-border/60 pt-4 text-sm text-muted-foreground">
              {t("subscriptions.activeCount")}:{" "}
              <strong className="font-semibold text-foreground">{summary.activeCount}</strong>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-border/60 bg-secondary/15 px-5 py-3 text-xs text-muted-foreground md:px-6">
          <span>
            {t("subscriptions.fullMonthly")}:{" "}
            <strong className="font-medium text-foreground">
              {money(summary.fullMonthly, currency)}
            </strong>
          </span>
          <span>
            {t("subscriptions.fullAnnual")}:{" "}
            <strong className="font-medium text-foreground">
              {money(summary.fullAnnual, currency)}
            </strong>
          </span>
        </div>
        {categoryMap.size > 0 && (
          <details className="border-t border-border/60 px-5 py-3 md:px-6">
            <summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
              {t("subscriptions.byCategory")}
            </summary>
            <div className="mt-4 space-y-3 pb-1">
              {[...categoryMap.entries()]
                .sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))
                .map(([category, amount]) => (
                  <div key={category} className="flex justify-between gap-3 text-sm">
                    <span>{category}</span>
                    <span className="text-right">
                      {money(amount, currency)} / {t("subscriptions.month")}
                    </span>
                  </div>
                ))}
            </div>
          </details>
        )}
      </TerminalCard>
      <TerminalCard title={t("subscriptions.upcoming")}>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("subscriptions.none")}</p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((s) => (
              <Link
                key={s.id}
                to="/subscriptions/$subscriptionId"
                params={{ subscriptionId: s.id }}
                className="flex justify-between gap-3 rounded-md p-2 text-sm hover:bg-secondary/40"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <SubscriptionLogo logoKey={s.logoKey} name={s.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate">{s.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {billingDate(s.nextBillingDate)}
                    </span>
                  </span>
                </span>
                <span className="text-right">
                  {money(s.amount, s.currency)}
                  <span className="block text-xs text-primary">
                    {t("subscriptions.myShare")}: {money(myShare(s), s.currency)}
                  </span>
                  {s.members.some((member) => member.paymentBehavior === "manual") && (
                    <span className="block text-xs text-muted-foreground">
                      {t("subscriptions.expectedManual")}:{" "}
                      {money(
                        s.members
                          .filter((member) => member.paymentBehavior === "manual")
                          .reduce((sum, member) => sum + memberShare(s, member), 0),
                        s.currency,
                      )}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        )}
      </TerminalCard>
      {data.fx.asOf && (
        <p className="text-xs text-muted-foreground">
          {t("subscriptions.fxAsOf", { date: billingDate(data.fx.asOf) })}
        </p>
      )}
      {[summary.myMonthly, summary.outstanding].some((value) => value === null) && (
        <p className="text-xs text-amber-300">{t("subscriptions.fxUnavailable")}</p>
      )}
    </div>
  );
}
