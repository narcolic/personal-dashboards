import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import {
  convert,
  money,
  setContributionPaid,
  useRefreshTracker,
  useTracker,
  type Contribution,
  type Period,
} from "@/lib/subscriptions";
import { billingDate, buttonClass, LoadingState, PageHeading } from "./components";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/subscriptions/owed")({
  component: MoneyOwed,
});

function MoneyOwed() {
  const { t } = useTranslation();
  const tracker = useTracker();
  const refresh = useRefreshTracker();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!tracker.data) return <LoadingState loading={tracker.isPending} error={tracker.error} />;
  const data = tracker.data;
  const subscriptions = new Map(data.state.subscriptions.map((s) => [s.id, s]));
  const grouped = new Map<string, { period: Period; contribution: Contribution }[]>();
  for (const period of data.state.periods)
    for (const contribution of period.contributions) {
      if (contribution.status !== "unpaid") continue;
      const list = grouped.get(contribution.personId) ?? [];
      list.push({ period, contribution });
      grouped.set(contribution.personId, list);
    }
  const hasOutstanding = [...grouped.values()].some((items) =>
    items.some(({ contribution }) => contribution.amount > 0),
  );
  async function markPaid(id: string) {
    setBusy(id);
    setError(null);
    try {
      await setContributionPaid(id, true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("subscriptions.saveFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeading title={t("subscriptions.owed")} />
      <TerminalCard>
        <div className="flex justify-between text-sm">
          <span>{t("subscriptions.totalOutstanding")}</span>
          <strong className={`text-xl ${hasOutstanding ? "text-destructive" : "text-primary"}`}>
            {money(data.summary.outstanding, data.state.homeCurrency)}
          </strong>
        </div>
      </TerminalCard>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {grouped.size === 0 && (
        <TerminalCard>
          <p className="text-sm text-muted-foreground">{t("subscriptions.nothingOwed")}</p>
        </TerminalCard>
      )}
      {[...grouped.entries()].map(([personId, items]) => {
        const person = data.state.people.find((p) => p.id === personId);
        const converted = items.map((item) =>
          convert(item.contribution.amount, item.period.currency, data),
        );
        const total = converted.some((value) => value === null)
          ? null
          : converted.reduce<number>((sum, value) => sum + (value ?? 0), 0);
        return (
          <TerminalCard
            key={personId}
            title={person?.name ?? t("subscriptions.unknownPerson")}
            actions={
              <strong
                className={
                  items.some(({ contribution }) => contribution.amount > 0)
                    ? "text-destructive"
                    : "text-primary"
                }
              >
                {money(total, data.state.homeCurrency)}
              </strong>
            }
          >
            <div className="space-y-3">
              {items.map(({ period, contribution }) => (
                <div
                  key={contribution.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <Link
                      to="/subscriptions/$subscriptionId"
                      params={{ subscriptionId: period.subscriptionId }}
                      className="text-sm text-foreground hover:text-primary"
                    >
                      {subscriptions.get(period.subscriptionId)?.name ??
                        t("subscriptions.subscription")}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {billingDate(period.billingDate)} ·{" "}
                      {money(contribution.amount, period.currency)}
                    </p>
                  </div>
                  <button
                    disabled={busy === contribution.id}
                    onClick={() => void markPaid(contribution.id)}
                    className={buttonClass}
                  >
                    {t("subscriptions.markPaid")}
                  </button>
                </div>
              ))}
            </div>
          </TerminalCard>
        );
      })}
      {data.summary.outstanding === null && (
        <p className="text-xs text-amber-300">{t("subscriptions.fxUnavailable")}</p>
      )}
    </div>
  );
}
