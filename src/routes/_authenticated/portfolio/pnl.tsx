import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/terminal/StatCard";
import { fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import { PnLBucket } from "@/routes/_authenticated/portfolio/components/PnLBucket";
import { usePortfolioData } from "@/routes/_authenticated/portfolio/hooks/usePortfolioData";
import { useQuotes } from "@/routes/_authenticated/portfolio/hooks/useQuotes";

export const Route = createFileRoute("/_authenticated/portfolio/pnl")({
  component: PnL,
});

function PnL() {
  const { t } = useTranslation();
  const router = useRouter();
  const { transactions } = usePortfolioData({ includePortfolios: false });
  const { enrichedRows } = useQuotes(transactions);

  const rows = useMemo(() => {
    const groups = new Map<string, (typeof enrichedRows)[number][]>();

    for (const row of enrichedRows) {
      const name = (row.quote?.shortName || row.name || row.ticker).trim();
      const currency = (row.currency || row.quote?.currency || "USD").toUpperCase();
      const key = `${row.ticker.toUpperCase()}|${name.toUpperCase()}|${currency}`;
      const bucket = groups.get(key) ?? [];
      bucket.push(row);
      groups.set(key, bucket);
    }

    return Array.from(groups.values())
      .map((items) => {
        if (items.length === 1) return items[0];

        const first = items[0];
        const shares = items.reduce((sum, item) => sum + Number(item.shares), 0);
        const marketValue = items.reduce((sum, item) => sum + Number(item.marketValue), 0);
        const costBasis = items.reduce((sum, item) => sum + Number(item.costBasis), 0);
        const unrealized = marketValue - costBasis;
        const dayChange = items.reduce((sum, item) => sum + Number(item.dayChange), 0);
        const price = shares ? marketValue / shares : Number(first.price);
        const prevClose = shares ? price - dayChange / shares : Number(first.prevClose);

        return {
          ...first,
          id: `${first.ticker.toUpperCase()}|${(first.quote?.shortName || first.name || first.ticker).trim().toUpperCase()}|${(first.currency || first.quote?.currency || "USD").toUpperCase()}`,
          shares,
          avg_cost: shares ? costBasis / shares : Number(first.avg_cost),
          tx_count: items.reduce((sum, item) => sum + Number(item.tx_count), 0),
          first_date: items.reduce(
            (min, item) =>
              !min || (item.first_date && item.first_date < min) ? item.first_date : min,
            first.first_date,
          ),
          last_date: items.reduce(
            (max, item) =>
              !max || (item.last_date && item.last_date > max) ? item.last_date : max,
            first.last_date,
          ),
          marketValue,
          costBasis,
          unrealized,
          unrealizedPct: costBasis ? (unrealized / costBasis) * 100 : 0,
          dayChange,
          dayChangePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
          price,
          prevClose,
        };
      })
      .sort((a, b) => b.unrealized - a.unrealized);
  }, [enrichedRows]);

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
  const totalUnrealized = totalsByCurrency(rows);
  const totalDayPnl = rows.reduce<Record<string, number>>((acc, row) => {
    const ccy = (row.currency || row.quote?.currency || "USD").toUpperCase();
    acc[ccy] = (acc[ccy] ?? 0) + row.dayChange;
    return acc;
  }, {});
  const bestPerformer = rows[0] ?? null;
  const worstPerformer = rows[rows.length - 1] ?? null;
  const maxHeaderLines = Math.max(
    Object.keys(gainTotals).length || 1,
    Object.keys(lossTotals).length || 1,
  );
  const goToHoldingDetails = (ticker: string) => {
    router.navigate({ to: "/portfolio/holdings/$ticker", params: { ticker } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl uppercase tracking-[0.2em]">{`> ${t("header.pnl")}`}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={t("portfolio.totalUnrealizedPnl")}
          value={formatTotals(totalUnrealized)}
          tone={sumTotals(totalUnrealized) >= 0 ? "bull" : "bear"}
        />
        <StatCard
          label={t("portfolio.dayPnl")}
          value={formatTotals(totalDayPnl)}
          tone={sumTotals(totalDayPnl) >= 0 ? "bull" : "bear"}
        />
        <StatCard
          label={t("portfolio.bestPerformer")}
          value={bestPerformer ? bestPerformer.ticker : "-"}
          sub={
            bestPerformer
              ? `${fmtPct(bestPerformer.unrealizedPct)} | ${fmtCurrency(
                  bestPerformer.unrealized,
                  (bestPerformer.currency || bestPerformer.quote?.currency || "USD").toUpperCase(),
                )}`
              : undefined
          }
          tone={bestPerformer && bestPerformer.unrealized >= 0 ? "bull" : undefined}
        />
        <StatCard
          label={t("portfolio.worstPerformer")}
          value={worstPerformer ? worstPerformer.ticker : "-"}
          sub={
            worstPerformer
              ? `${fmtPct(worstPerformer.unrealizedPct)} | ${fmtCurrency(
                  worstPerformer.unrealized,
                  (
                    worstPerformer.currency ||
                    worstPerformer.quote?.currency ||
                    "USD"
                  ).toUpperCase(),
                )}`
              : undefined
          }
          tone={worstPerformer && worstPerformer.unrealized < 0 ? "bear" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PnLBucket
          title={t("portfolio.gainers")}
          tone="bull"
          totalsByCurrency={gainTotals}
          headerLineCount={maxHeaderLines}
          rows={gainers}
          onRowClick={(row) => goToHoldingDetails(row.ticker)}
        />
        <PnLBucket
          title={t("portfolio.losers")}
          tone="bear"
          totalsByCurrency={lossTotals}
          headerLineCount={maxHeaderLines}
          rows={losers}
          onRowClick={(row) => goToHoldingDetails(row.ticker)}
        />
      </div>
    </div>
  );
}

function sumTotals(totals: Record<string, number>) {
  return Object.values(totals).reduce((sum, value) => sum + value, 0);
}

function formatTotals(totals: Record<string, number>) {
  const entries = Object.entries(totals);
  if (entries.length === 0) return "-";
  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, value]) => fmtCurrency(value, currency))
    .join(" | ");
}
