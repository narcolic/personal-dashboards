import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import { PortfolioWorkspaceProvider } from "@/routes/_authenticated/portfolio/components/PortfolioWorkspaceContext";
import { usePortfolioWorkspace } from "@/routes/_authenticated/portfolio/components/PortfolioWorkspaceState";
import { usePortfolioData } from "@/routes/_authenticated/portfolio/hooks/usePortfolioData";

export const Route = createFileRoute("/_authenticated/portfolio")({
  component: PortfolioLayout,
});

function PortfolioLayout() {
  return (
    <PortfolioWorkspaceProvider>
      <div className="relative isolate overflow-x-clip">
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
    <div className="mb-6 grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-x-2 gap-y-2 rounded-lg border border-border/50 bg-card/35 p-2 sm:mb-5 sm:flex sm:border-0 sm:bg-transparent sm:p-0 sm:px-1">
      <div className="contents sm:flex sm:min-w-0 sm:flex-1 sm:items-center sm:gap-2">
        <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-xs sm:tracking-[0.14em]">
          {t("portfolio.scope")}:
        </span>
        {showPortfolioSegments ? (
          <div
            className="grid min-w-0 gap-1 rounded-md bg-secondary/25 p-0.5 sm:flex sm:max-w-full sm:overflow-x-auto"
            style={{ gridTemplateColumns: `repeat(${portfolios.length + 1}, minmax(0, 1fr))` }}
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
                  className={`h-8 min-w-0 truncate rounded px-1 text-[10px] font-semibold uppercase tracking-[0.06em] transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:shrink-0 sm:px-3 sm:text-xs sm:tracking-[0.1em] ${
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
          <TerminalSelect
            value={selectedPortfolioId}
            onChange={setSelectedPortfolioId}
            ariaLabel={t("portfolio.portfolio")}
            options={[
              { value: allPortfoliosId, label: t("portfolio.all") },
              ...portfolios.map((portfolio) => ({
                value: portfolio.id,
                label: portfolio.name,
              })),
            ]}
            size="sm"
            className="min-w-0 flex-1 sm:max-w-xs"
          />
        )}
      </div>

      <div className="contents sm:flex sm:items-center sm:gap-2 sm:self-start">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground sm:text-xs sm:tracking-[0.14em]">
          {t("portfolio.currency")}:
        </span>
        <div
          className="grid h-8 w-full grid-cols-2 rounded-md bg-secondary/25 p-0.5 sm:inline-flex sm:w-auto"
          role="group"
          aria-label={t("portfolio.currency")}
        >
          {(["EUR", "USD"] as const).map((currency) => (
            <button
              key={currency}
              type="button"
              onClick={() => setDisplayCurrency(currency)}
              aria-pressed={displayCurrency === currency}
              className={`min-w-0 rounded px-2 text-[10px] font-semibold tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:min-w-12 sm:px-3 sm:text-xs sm:tracking-[0.1em] ${
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
