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
        {tracker.data.state.subscriptions.map((s) => {
          const share = myShare(s);
          return (
            <Link
              key={s.id}
              to="/subscriptions/$subscriptionId"
              params={{ subscriptionId: s.id }}
              className="block rounded-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <TerminalCard className="h-full hover:border-primary" bodyClassName="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <SubscriptionLogo logoKey={s.logoKey} name={s.name} size="sm" />
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-primary">{s.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {s.category?.trim() ? `${s.category.trim()} · ` : ""}
                        {s.intervalMonths === 1
                          ? t("subscriptions.monthly")
                          : s.intervalMonths === 12
                            ? t("subscriptions.yearly")
                            : t("subscriptions.everyMonthsValue", { count: s.intervalMonths })}
                        {!s.isActive ? ` · ${t("subscriptions.inactive")}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="max-w-[50%] shrink-0 text-right text-sm font-semibold tabular-nums">
                    <Converted amount={s.amount} currency={s.currency} overview={tracker.data} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {t("subscriptions.nextBilling")}: {billingDate(s.nextBillingDate)}
                  </span>
                  {share !== s.amount && (
                    <span className="text-right text-primary">
                      {t("subscriptions.myShare")}:{" "}
                      <Converted amount={share} currency={s.currency} overview={tracker.data} />
                    </span>
                  )}
                </div>
              </TerminalCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
