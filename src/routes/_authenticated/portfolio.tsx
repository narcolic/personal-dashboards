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
  const showPortfolioSegments = portfolios.length <= 3;

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
    <div className="mb-5 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {t("portfolio.scope")}:
        </span>
        {showPortfolioSegments ? (
          <div
            className="flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-md bg-secondary/25 p-0.5"
            role="group"
            aria-label={t("portfolio.portfolio")}
          >
            {[
              { id: allPortfoliosId, name: t("portfolio.all") },
              ...portfolios.map((portfolio) => ({ id: portfolio.id, name: portfolio.name })),
            ].map((portfolio) => {
              const isSelected = selectedPortfolioId === portfolio.id;

              return (
                <button
                  key={portfolio.id}
                  type="button"
                  onClick={() => setSelectedPortfolioId(portfolio.id)}
                  aria-pressed={isSelected}
                  className={`h-8 shrink-0 rounded px-3 text-xs font-semibold uppercase tracking-[0.1em] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-14px_var(--color-primary)]"
                      : "text-muted-foreground hover:bg-secondary/45 hover:text-foreground"
                  }`}
                >
                  {portfolio.name}
                </button>
              );
            })}
          </div>
        ) : (
          <select
            value={selectedPortfolioId}
            onChange={(event) => setSelectedPortfolioId(event.target.value)}
            aria-label={t("portfolio.portfolio")}
            className="h-8 min-w-0 flex-1 rounded-md border border-border/70 bg-background/70 px-3 text-sm outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30 sm:max-w-xs"
          >
            <option value={allPortfoliosId}>{t("portfolio.all")}</option>
            {portfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolio.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-2 self-start">
        <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {t("portfolio.currency")}:
        </span>
        <div
          className="inline-flex h-8 rounded-md bg-secondary/25 p-0.5"
          role="group"
          aria-label={t("portfolio.currency")}
        >
          {(["EUR", "USD"] as const).map((currency) => (
            <button
              key={currency}
              type="button"
              onClick={() => setDisplayCurrency(currency)}
              aria-pressed={displayCurrency === currency}
              className={`min-w-12 rounded px-3 text-xs font-semibold tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                displayCurrency === currency
                  ? "bg-card text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {currency}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
