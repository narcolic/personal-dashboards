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
  const { enrichedRows } = useQuotes(transactions);

  const rows = useMemo(
    () => enrichedRows.slice().sort((a, b) => b.unrealized - a.unrealized),
    [enrichedRows],
  );

  const gainers = rows.filter((r) => r.unrealized >= 0);
  const losers = rows.filter((r) => r.unrealized < 0).reverse();

  const totalsByCurrency = (bucketRows: typeof rows) =>
    bucketRows.reduce<Record<string, number>>((acc, row) => {
      const ccy = (row.currency || row.quote?.currency || "USD").toUpperCase();
      acc[ccy] = (acc[ccy] ?? 0) + row.unrealized;
      return acc;
    }, {});

  const gainTotals = totalsByCurrency(gainers);
  const lossTotals = totalsByCurrency(losers);
  const maxHeaderLines = Math.max(
    Object.keys(gainTotals).length || 1,
    Object.keys(lossTotals).length || 1,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl uppercase tracking-[0.2em]">{t("portfolio.gainLoss")}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PnLBucket
          title={t("portfolio.gainers")}
          tone="bull"
          totalsByCurrency={gainTotals}
          headerLineCount={maxHeaderLines}
          rows={gainers}
        />
        <PnLBucket
          title={t("portfolio.losers")}
          tone="bear"
          totalsByCurrency={lossTotals}
          headerLineCount={maxHeaderLines}
          rows={losers}
        />
      </div>
    </div>
  );
}
