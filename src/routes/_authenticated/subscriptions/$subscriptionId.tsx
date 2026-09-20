import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { TerminalCard } from "@/components/terminal/TerminalCard";
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
  PageHeading,
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
      <PageHeading title={subscription.name} />
      {editing ? (
        <SubscriptionEditor
          initial={subscription}
          people={data.state.people}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="flex gap-2">
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
          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <TerminalCard title={t("subscriptions.details")}>
              <div className="space-y-3 text-sm">
                <Row label={t("subscriptions.fullCost")}>
                  <Converted
                    amount={subscription.amount}
                    currency={subscription.currency}
                    overview={data}
                  />
                </Row>
                <Row label={t("subscriptions.myShare")}>
                  <Converted
                    amount={myShare(subscription)}
                    currency={subscription.currency}
                    overview={data}
                  />
                </Row>
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
                <Row label={t("subscriptions.status")}>
                  {subscription.isActive ? t("subscriptions.active") : t("subscriptions.inactive")}
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
              <div className="space-y-3 text-sm">
                <Row label={t("subscriptions.me")}>
                  {money(myShare(subscription), subscription.currency)}
                </Row>
                {subscription.members.map((member) => (
                  <Row
                    key={member.personId}
                    label={people.get(member.personId) ?? t("subscriptions.unknownPerson")}
                  >
                    {money(memberShare(subscription, member), subscription.currency)}{" "}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {member.paymentBehavior === "auto"
                        ? t("subscriptions.autoPay")
                        : t("subscriptions.manual")}
                    </span>
                  </Row>
                ))}
              </div>
            </TerminalCard>
          </div>
          <TerminalCard title={t("subscriptions.currentOutstanding")}>
            {unpaid.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("subscriptions.nothingOwed")}</p>
            ) : (
              <div className="space-y-2">
                {unpaid.map(({ c, period }) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-2 text-sm last:border-0"
                  >
                    <span>
                      {people.get(c.personId)} · {billingDate(period.billingDate)} ·{" "}
                      {money(c.amount, period.currency)}
                    </span>
                    <button
                      disabled={busy === c.id}
                      className={buttonClass}
                      onClick={() => void changePaid(c)}
                    >
                      {t("subscriptions.markPaid")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TerminalCard>
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
                      <span>
                        {t("subscriptions.fullCost")}: {money(period.fullAmount, period.currency)} ·{" "}
                        {t("subscriptions.myShare")}: {money(period.myAmount, period.currency)}
                      </span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {period.contributions.map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <span>
                            {people.get(c.personId)} · {money(c.amount, period.currency)} ·{" "}
                            {c.status === "auto_received"
                              ? t("subscriptions.assumedReceived")
                              : c.status === "paid"
                                ? t("subscriptions.paid")
                                : t("subscriptions.unpaid")}
                            {c.paidAt && c.status === "paid"
                              ? ` · ${billingDate(c.paidAt.slice(0, 10))}`
                              : ""}
                          </span>
                          {c.paymentBehavior === "manual" && (
                            <button
                              className={secondaryButtonClass}
                              disabled={busy === c.id}
                              onClick={() => void changePaid(c)}
                            >
                              {c.status === "paid"
                                ? t("subscriptions.markUnpaid")
                                : t("subscriptions.markPaid")}
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
