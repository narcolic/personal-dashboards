import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { dashboards } from "@/components/shell/dashboards";
import { useQuotes } from "@/routes/_authenticated/portfolio/hooks/useQuotes";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import { portfolioHoldingsQueryOptions } from "@/lib/portfolio/queries";
import type { HoldingRow } from "@/lib/portfolio/types";
import { useCarServiceAnalytics } from "@/routes/_authenticated/car-service/hooks/useCarServiceAnalytics";
import {
  formatCurrency as formatCarCurrency,
  formatDate as formatCarDate,
} from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";
import { BottomStatusBar } from "@/components/shell/BottomStatusBar";

const EMPTY_HOLDINGS: HoldingRow[] = [];

export function AppHub() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground grid-bg px-4 py-8 pb-14">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-primary">
              {t("shell.hub")}
            </div>
            <h1 className="mt-2 text-2xl font-bold uppercase tracking-[0.2em]">
              {t("shell.dashboards")}
            </h1>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dashboards.map((dashboard) =>
            dashboard.path ? (
              <Link key={dashboard.titleKey} to={dashboard.path} className="block">
                <TerminalCard
                  bodyClassName="p-4 flex h-full flex-col"
                  className="h-full hover:border-primary"
                >
                  <div className="mt-1 text-lg font-bold text-primary">{t(dashboard.titleKey)}</div>
                  <div className="flex-1">
                    <p className="mt-1 text-[12px] text-muted-foreground/80">
                      {t(dashboard.descriptionKey)}
                    </p>
                    {dashboard.titleKey === "dashboards.portfolioTitle" ? (
                      <PortfolioHubSummary />
                    ) : null}
                    {dashboard.titleKey === "dashboards.carServiceTitle" ? (
                      <CarServiceHubSummary />
                    ) : null}
                  </div>
                  <div className="mt-3 border-t border-border/70 pt-2 text-[10px] uppercase tracking-[0.25em] text-foreground">
                    {t("shell.open")}
                  </div>
                </TerminalCard>
              </Link>
            ) : (
              <TerminalCard
                key={dashboard.titleKey}
                bodyClassName="p-4 flex h-full flex-col"
                className="h-full border-border/40 bg-card/50 opacity-75"
              >
                <div className="mt-1 text-lg font-bold text-primary/65">
                  {t(dashboard.titleKey)}
                </div>
                <div className="flex-1">
                  <p className="mt-1 text-[12px] text-muted-foreground/70">
                    {t(dashboard.descriptionKey)}
                  </p>
                </div>
                <div className="mt-3 border-t border-border/50 pt-2">
                  <div className="inline-flex cursor-not-allowed items-center border border-border/50 bg-background/40 px-2 py-1 text-[9px] uppercase tracking-[0.22em] text-muted-foreground/80">
                    {t("shell.comingSoon")}
                  </div>
                </div>
              </TerminalCard>
            ),
          )}
        </div>
      </div>
      <BottomStatusBar />
    </div>
  );
}

function PortfolioHubSummary() {
  const { t } = useTranslation();
  const holdingsQ = useQuery(portfolioHoldingsQueryOptions());
  const { enrichedRows, quotesQ } = useQuotes(holdingsQ.data ?? EMPTY_HOLDINGS, {
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  if (holdingsQ.isLoading || quotesQ.isLoading) {
    return (
      <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {t("common.loading")}
      </div>
    );
  }

  if (holdingsQ.isError || quotesQ.isError) {
    return (
      <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {t("common.noData")}
      </div>
    );
  }

  if (enrichedRows.length === 0) {
    return (
      <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {t("common.noData")}
      </div>
    );
  }

  const totalValue = enrichedRows.reduce((sum, row) => sum + row.marketValue, 0);

  return (
    <div className="mt-3 space-y-1">
      <div className="h-2" aria-hidden="true" />
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">value</div>
      <div className="truncate text-xl font-bold leading-tight text-foreground">
        {fmtCurrency(totalValue, "USD")}
      </div>
    </div>
  );
}

function CarServiceHubSummary() {
  const { t } = useTranslation();
  const { analytics, isLoading, error } = useCarServiceAnalytics("all");

  if (isLoading) {
    return (
      <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {t("common.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {t("common.noData")}
      </div>
    );
  }

  if (!analytics || analytics.visitCount === 0) {
    return (
      <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        {t("common.noData")}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="h-2" aria-hidden="true" />
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.17em] text-muted-foreground/80">
          last
        </span>
        <span className="text-sm font-semibold text-foreground">
          {analytics.lastVisitDate ? formatCarDate(analytics.lastVisitDate) : "--"}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.17em] text-muted-foreground/80">
          year
        </span>
        <span className="text-sm font-semibold text-foreground">
          {formatCarCurrency(analytics.costThisYear)}
        </span>
      </div>
    </div>
  );
}
