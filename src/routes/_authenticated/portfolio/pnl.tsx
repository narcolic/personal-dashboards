import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PnLBucket } from "@/routes/_authenticated/portfolio/components/PnLBucket";
import { usePortfolioData } from "@/routes/_authenticated/portfolio/hooks/usePortfolioData";
import { useQuotes } from "@/routes/_authenticated/portfolio/hooks/useQuotes";

export const Route = createFileRoute("/_authenticated/portfolio/pnl")({
  component: PnL,
});

function PnL() {
  const { t } = useTranslation();
  const { transactions } = usePortfolioData({ includePortfolios: false });
  const { tickers, quotesQ, enrichedRows } = useQuotes(transactions);

  const rows = useMemo(
    () => enrichedRows.slice().sort((a, b) => b.unrealized - a.unrealized),
    [enrichedRows],
  );

  const gainers = rows.filter((r) => r.unrealized >= 0);
  const losers = rows.filter((r) => r.unrealized < 0).reverse();
  const totalGain = gainers.reduce((s, r) => s + r.unrealized, 0);
  const totalLoss = losers.reduce((s, r) => s + r.unrealized, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl uppercase tracking-[0.2em]">{t("portfolio.gainLoss")}</h1>
        <button
          className="border border-border bg-card px-4 text-[11px] uppercase tracking-[0.2em] hover:text-primary disabled:opacity-50"
          disabled={tickers.length === 0}
          onClick={() => quotesQ.refetch()}
        >
          {t("portfolio.sync")}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PnLBucket title={t("portfolio.gainers")} tone="bull" total={totalGain} rows={gainers} />
        <PnLBucket title={t("portfolio.losers")} tone="bear" total={totalLoss} rows={losers} />
      </div>
    </div>
  );
}
