import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PortfolioWorkspaceProvider } from "@/routes/_authenticated/portfolio/components/PortfolioWorkspaceContext";
import { usePortfolioWorkspace } from "@/routes/_authenticated/portfolio/components/PortfolioWorkspaceState";
import { usePortfolioData } from "@/routes/_authenticated/portfolio/hooks/usePortfolioData";

export const Route = createFileRoute("/_authenticated/portfolio")({
  component: PortfolioLayout,
});

function PortfolioLayout() {
  return (
    <PortfolioWorkspaceProvider>
      <div className="relative isolate">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-28 -z-10 h-80 w-80 rounded-full bg-primary/[0.045] blur-3xl"
        />
        <PortfolioContextBar />
        <Outlet />
      </div>
    </PortfolioWorkspaceProvider>
  );
}

function PortfolioContextBar() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { portfolios, portfoliosQ } = usePortfolioData();
  const {
    selectedPortfolioId,
    setSelectedPortfolioId,
    displayCurrency,
    setDisplayCurrency,
    allPortfoliosId,
  } = usePortfolioWorkspace();
  const showContext = pathname === "/portfolio" || pathname === "/portfolio/insights";

  useEffect(() => {
    if (portfoliosQ.isLoading) return;
    if (
      selectedPortfolioId !== allPortfoliosId &&
      !portfolios.some((portfolio) => portfolio.id === selectedPortfolioId)
    ) {
      setSelectedPortfolioId(allPortfoliosId);
    }
  }, [
    allPortfoliosId,
    portfolios,
    portfoliosQ.isLoading,
    selectedPortfolioId,
    setSelectedPortfolioId,
  ]);

  if (!showContext) return null;

  return (
    <div className="analytics-panel mb-6 flex flex-col gap-3 rounded-[10px] border border-border/70 bg-card/70 p-3 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] sm:flex-row sm:items-center sm:justify-between">
      <label className="flex min-w-0 flex-1 items-center gap-3">
        <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {t("portfolio.portfolio")}
        </span>
        <select
          value={selectedPortfolioId}
          onChange={(event) => setSelectedPortfolioId(event.target.value)}
          className="h-10 min-w-0 flex-1 rounded-lg border border-border/70 bg-background/70 px-3 text-sm outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30 sm:max-w-xs"
        >
          <option value={allPortfoliosId}>{t("portfolio.all")}</option>
          {portfolios.map((portfolio) => (
            <option key={portfolio.id} value={portfolio.id}>
              {portfolio.name}
            </option>
          ))}
        </select>
      </label>

      <div
        className="inline-flex h-10 self-start rounded-lg border border-border/70 bg-secondary/45 p-1"
        role="group"
        aria-label={t("portfolio.currency")}
      >
        {(["EUR", "USD"] as const).map((currency) => (
          <button
            key={currency}
            type="button"
            onClick={() => setDisplayCurrency(currency)}
            aria-pressed={displayCurrency === currency}
            className={`min-w-14 rounded-md px-3 text-xs font-semibold tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              displayCurrency === currency
                ? "bg-card text-primary shadow-sm ring-1 ring-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {currency}
          </button>
        ))}
      </div>
    </div>
  );
}
