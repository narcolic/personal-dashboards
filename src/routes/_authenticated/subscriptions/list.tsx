import { createFileRoute, Link } from "@tanstack/react-router";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { SubscriptionLogo } from "@/components/subscriptions/SubscriptionLogo";
import { myShare, useTracker } from "@/lib/subscriptions";
import { billingDate, Converted, LoadingState, PageHeading } from "./components";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/subscriptions/list")({
  component: SubscriptionList,
});

function SubscriptionList() {
  const { t } = useTranslation();
  const tracker = useTracker();
  if (!tracker.data) return <LoadingState loading={tracker.isPending} error={tracker.error} />;
  return (
    <div className="space-y-5">
      <PageHeading
        title={t("subscriptions.subscriptions")}
        action={{ to: "/subscriptions/new", label: t("subscriptions.add") }}
      />
      {tracker.data.state.subscriptions.length === 0 && (
        <TerminalCard>{t("subscriptions.empty")}</TerminalCard>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {tracker.data.state.subscriptions.map((s) => (
          <Link
            key={s.id}
            to="/subscriptions/$subscriptionId"
            params={{ subscriptionId: s.id }}
            className="block"
          >
            <TerminalCard className="h-full hover:border-primary" bodyClassName="p-4">
              <div className="flex justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SubscriptionLogo logoKey={s.logoKey} name={s.name} />
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-primary">{s.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {s.category || t("subscriptions.uncategorized")} ·{" "}
                      {s.intervalMonths === 1
                        ? t("subscriptions.monthly")
                        : s.intervalMonths === 12
                          ? t("subscriptions.yearly")
                          : t("subscriptions.everyMonthsValue", { count: s.intervalMonths })}
                    </p>
                  </div>
                </div>
                {!s.isActive && (
                  <span className="text-xs text-muted-foreground">
                    {t("subscriptions.inactive")}
                  </span>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="block text-xs text-muted-foreground">
                    {t("subscriptions.fullCost")}
                  </span>
                  <Converted amount={s.amount} currency={s.currency} overview={tracker.data} />
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">
                    {t("subscriptions.myShare")}
                  </span>
                  <Converted amount={myShare(s)} currency={s.currency} overview={tracker.data} />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("subscriptions.nextBilling")}: {billingDate(s.nextBillingDate)}
              </p>
            </TerminalCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
