import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { SubscriptionLogo } from "@/components/subscriptions/SubscriptionLogo";
import { apiFetch } from "@/lib/api/client";
import {
  memberShare,
  money,
  myShare,
  setContributionPaid,
  useRefreshTracker,
  useTracker,
  type Contribution,
} from "@/lib/subscriptions";
import {
  billingDate,
  buttonClass,
  Converted,
  LoadingState,
  secondaryButtonClass,
} from "./components";
import { SubscriptionEditor } from "./-SubscriptionEditor";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/subscriptions/$subscriptionId")({
  component: SubscriptionDetails,
});

function SubscriptionDetails() {
  const { subscriptionId } = Route.useParams();
  const { t } = useTranslation();
  const tracker = useTracker();
  const refresh = useRefreshTracker();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!tracker.data) return <LoadingState loading={tracker.isPending} error={tracker.error} />;
  const data = tracker.data;
  const subscription = data.state.subscriptions.find((item) => item.id === subscriptionId);
  if (!subscription) return <LoadingState loading={false} />;
  const periods = data.state.periods.filter((period) => period.subscriptionId === subscriptionId);
  const people = new Map(data.state.people.map((person) => [person.id, person.name]));
  const unpaid = periods.flatMap((period) =>
    period.contributions.filter((c) => c.status === "unpaid").map((c) => ({ c, period })),
  );
  async function changePaid(c: Contribution) {
    setBusy(c.id);
    setError(null);
    try {
      await setContributionPaid(c.id, c.status !== "paid");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("subscriptions.saveFailed"));
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    if (!window.confirm(t("subscriptions.confirmDelete"))) return;
    setBusy("delete");
    setError(null);
    try {
      await apiFetch<void>(`/api/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        method: "DELETE",
      });
      await refresh();
      await navigate({ to: "/subscriptions/list" });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("subscriptions.saveFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SubscriptionLogo logoKey={subscription.logoKey} name={subscription.name} size="lg" />
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="min-w-0 text-xl font-bold uppercase tracking-[0.12em] text-foreground">
              <span className="text-primary">&gt; </span>
              {subscription.name}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                subscription.isActive
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                  : "border-border bg-secondary/40 text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${subscription.isActive ? "bg-emerald-400" : "bg-muted-foreground"}`}
              />
              {subscription.isActive ? t("subscriptions.active") : t("subscriptions.inactive")}
            </span>
          </div>
        </div>
        {!editing && (
          <div className="flex shrink-0 gap-2">
            <button className={buttonClass} onClick={() => setEditing(true)}>
              {t("common.edit")}
            </button>
            {periods.length === 0 && (
              <button
                className={secondaryButtonClass}
                disabled={busy === "delete"}
                onClick={() => void remove()}
              >
                {t("common.delete")}
              </button>
            )}
          </div>
        )}
      </div>
      {editing ? (
        <SubscriptionEditor
          initial={subscription}
          people={data.state.people}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <TerminalCard title={t("subscriptions.details")}>
              <div className="grid gap-4 border-b border-border/50 pb-4 sm:grid-cols-2">
                <div className="sm:border-r sm:border-border/50">
                  <p className="text-xs text-muted-foreground">{t("subscriptions.myShare")}</p>
                  <p className="mt-1 text-xl font-bold text-primary">
                    <Converted
                      amount={myShare(subscription)}
                      currency={subscription.currency}
                      overview={data}
                    />
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t("subscriptions.fullCost")}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    <Converted
                      amount={subscription.amount}
                      currency={subscription.currency}
                      overview={data}
                    />
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <Row label={t("subscriptions.frequency")}>
                  {subscription.intervalMonths === 1
                    ? t("subscriptions.monthly")
                    : subscription.intervalMonths === 12
                      ? t("subscriptions.yearly")
                      : t("subscriptions.everyMonthsValue", { count: subscription.intervalMonths })}
                </Row>
                <Row label={t("subscriptions.nextBilling")}>
                  {billingDate(subscription.nextBillingDate)}
                </Row>
                {subscription.category && (
                  <Row label={t("subscriptions.category")}>{subscription.category}</Row>
                )}
                {subscription.description && (
                  <Row label={t("subscriptions.description")}>{subscription.description}</Row>
                )}
                {subscription.notes && (
                  <Row label={t("subscriptions.notes")}>{subscription.notes}</Row>
                )}
              </div>
            </TerminalCard>
            <TerminalCard title={t("subscriptions.members")}>
              <div className="divide-y divide-border/40 text-sm">
                <div className="flex items-center justify-between gap-3 py-2 first:pt-0">
                  <span className="font-semibold text-primary">{t("subscriptions.me")}</span>
                  <strong>{money(myShare(subscription), subscription.currency)}</strong>
                </div>
                {subscription.members.map((member) => (
                  <div
                    key={member.personId}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        {people.get(member.personId) ?? t("subscriptions.unknownPerson")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {member.paymentBehavior === "auto"
                          ? t("subscriptions.autoPay")
                          : t("subscriptions.manual")}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">
                      {money(memberShare(subscription, member), subscription.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </TerminalCard>
          </div>
          {unpaid.length === 0 ? (
            <p className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
              <span aria-hidden="true">✓</span> {t("subscriptions.allCaughtUp")}
            </p>
          ) : (
            <TerminalCard title={t("subscriptions.currentOutstanding")}>
              <div className="space-y-2">
                {unpaid.map(({ c, period }) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2 text-sm last:border-0"
                  >
                    <span>
                      <strong>{people.get(c.personId) ?? t("subscriptions.unknownPerson")}</strong>
                      <span className="ml-2 text-muted-foreground">
                        {billingDate(period.billingDate)}
                      </span>
                      <span className="ml-2 font-semibold text-destructive">
                        {money(c.amount, period.currency)}
                      </span>
                    </span>
                    <button
                      disabled={busy === c.id}
                      className={buttonClass}
                      onClick={() => void changePaid(c)}
                    >
                      {t("subscriptions.recordPayment")}
                    </button>
                  </div>
                ))}
              </div>
            </TerminalCard>
          )}
          <TerminalCard title={t("subscriptions.paymentHistory")}>
            {periods.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("subscriptions.noHistory")}</p>
            ) : (
              <div className="space-y-5">
                {periods.map((period) => (
                  <div
                    key={period.id}
                    className="border-b border-border/50 pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
                      <span>{billingDate(period.billingDate)}</span>
                      <span className="text-primary">
                        {t("subscriptions.myShare")}: {money(period.myAmount, period.currency)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("subscriptions.fullCost")}: {money(period.fullAmount, period.currency)}
                    </p>
                    <div className="mt-2 space-y-2">
                      {period.contributions.map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-secondary/20 px-3 py-2 text-sm"
                        >
                          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-medium">
                              {people.get(c.personId) ?? t("subscriptions.unknownPerson")}
                            </span>
                            <span className="font-semibold">
                              {money(c.amount, period.currency)}
                            </span>
                            <span
                              className={`text-xs ${c.status === "unpaid" ? "text-destructive" : c.status === "paid" ? "text-emerald-400" : "text-muted-foreground"}`}
                            >
                              {c.status === "auto_received"
                                ? t("subscriptions.assumedReceived")
                                : c.status === "paid"
                                  ? t("subscriptions.paid")
                                  : t("subscriptions.unpaid")}
                              {c.paidAt && c.status === "paid"
                                ? ` · ${billingDate(c.paidAt.slice(0, 10))}`
                                : ""}
                            </span>
                          </span>
                          {c.paymentBehavior === "manual" && (
                            <button
                              className={`${secondaryButtonClass} min-h-8 px-3 text-[11px]`}
                              disabled={busy === c.id}
                              onClick={() => void changePaid(c)}
                            >
                              {c.status === "paid"
                                ? t("subscriptions.undoPayment")
                                : t("subscriptions.recordPayment")}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TerminalCard>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-border/40 pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
