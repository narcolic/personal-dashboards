import { useMemo } from "react";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { StatCard } from "@/components/terminal/StatCard";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import { usePortfolioSnapshots } from "@/routes/_authenticated/portfolio/hooks/usePortfolioSnapshots";
import type { PortfolioSnapshotRow } from "@/routes/_authenticated/portfolio/hooks/usePortfolioSnapshots";
import { useTranslation } from "react-i18next";

type SnapshotCurrency = "EUR" | "USD";
type SnapshotMetric = "market" | "unrealized";

function metricValue(
  row: PortfolioSnapshotRow,
  currency: SnapshotCurrency,
  metric: SnapshotMetric,
) {
  if (metric === "market") {
    return currency === "EUR" ? row.market_value_eur : row.market_value_usd;
  }
  return currency === "EUR" ? row.unrealized_eur : row.unrealized_usd;
}

function latest(rows: PortfolioSnapshotRow[]) {
  return rows[0] ?? null;
}

function extreme(
  rows: PortfolioSnapshotRow[],
  currency: SnapshotCurrency,
  metric: SnapshotMetric,
  direction: "high" | "low",
) {
  return rows.reduce<PortfolioSnapshotRow | null>((winner, row) => {
    if (!winner) return row;
    const current = metricValue(row, currency, metric);
    const best = metricValue(winner, currency, metric);
    return direction === "high" ? (current > best ? row : winner) : current < best ? row : winner;
  }, null);
}

function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function PortfolioSnapshotStats({
  currency,
  onCardClick,
  title,
}: {
  currency: string;
  onCardClick?: () => void;
  title?: string;
}) {
  const { t } = useTranslation();
  const snapshotsQ = usePortfolioSnapshots();
  const selectedCurrency: SnapshotCurrency = currency.toUpperCase() === "USD" ? "USD" : "EUR";

  const stats = useMemo(() => {
    const rows = snapshotsQ.data ?? [];
    const totalRows = rows.filter((row) => row.scope === "total");
    const portfolioGroups = new Map<string, PortfolioSnapshotRow[]>();

    for (const row of rows) {
      if (row.scope !== "portfolio") continue;
      const group = portfolioGroups.get(row.scope_key) ?? [];
      group.push(row);
      portfolioGroups.set(row.scope_key, group);
    }

    return {
      totalRows,
      latestTotal: latest(totalRows),
      marketHigh: extreme(totalRows, selectedCurrency, "market", "high"),
      marketLow: extreme(totalRows, selectedCurrency, "market", "low"),
      unrealizedHigh: extreme(totalRows, selectedCurrency, "unrealized", "high"),
      unrealizedLow: extreme(totalRows, selectedCurrency, "unrealized", "low"),
      portfolios: Array.from(portfolioGroups.values())
        .map((group) => ({
          key: group[0]?.scope_key ?? "",
          name: group[0]?.portfolio_name ?? t("portfolio.unassigned"),
          latest: latest(group),
          marketHigh: extreme(group, selectedCurrency, "market", "high"),
          marketLow: extreme(group, selectedCurrency, "market", "low"),
          unrealizedHigh: extreme(group, selectedCurrency, "unrealized", "high"),
          unrealizedLow: extreme(group, selectedCurrency, "unrealized", "low"),
        }))
        .sort(
          (a, b) =>
            metricValue(b.latest ?? b.marketHigh ?? b.marketLow!, selectedCurrency, "market") -
            metricValue(a.latest ?? a.marketHigh ?? a.marketLow!, selectedCurrency, "market"),
        ),
    };
  }, [selectedCurrency, snapshotsQ.data, t]);

  if (snapshotsQ.isLoading) {
    return (
      <TerminalCard
        title={title ?? t("portfolio.snapshotHistory")}
        onClick={onCardClick}
        bodyClassName="p-3"
        className="border-border/60"
      >
        <div className="h-24 animate-pulse bg-secondary/40" />
      </TerminalCard>
    );
  }

  if (!stats.latestTotal) {
    return (
      <TerminalCard
        title={title ?? t("portfolio.snapshotHistory")}
        onClick={onCardClick}
        bodyClassName="p-3"
        className="border-border/60"
      >
        <div className="text-xs text-muted-foreground">{t("portfolio.noSnapshotsYet")}</div>
      </TerminalCard>
    );
  }

  const currencyFormat = (value: number) => fmtCurrency(value, selectedCurrency);

  return (
    <TerminalCard
      title={title ?? t("portfolio.snapshotHistory")}
      onClick={onCardClick}
      bodyClassName="p-3"
      className="border-border/60"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("portfolio.peakValue")}
            value={currencyFormat(metricValue(stats.marketHigh!, selectedCurrency, "market"))}
            sub={formatDate(stats.marketHigh?.snapshot_date)}
            accent
            size="compact"
          />
          <StatCard
            label={t("portfolio.lowValue")}
            value={currencyFormat(metricValue(stats.marketLow!, selectedCurrency, "market"))}
            sub={formatDate(stats.marketLow?.snapshot_date)}
            size="compact"
          />
          <StatCard
            label={t("portfolio.peakUnrealized")}
            value={currencyFormat(
              metricValue(stats.unrealizedHigh!, selectedCurrency, "unrealized"),
            )}
            sub={formatDate(stats.unrealizedHigh?.snapshot_date)}
            tone={
              metricValue(stats.unrealizedHigh!, selectedCurrency, "unrealized") >= 0
                ? "bull"
                : "bear"
            }
            size="compact"
          />
          <StatCard
            label={t("portfolio.lowUnrealized")}
            value={currencyFormat(
              metricValue(stats.unrealizedLow!, selectedCurrency, "unrealized"),
            )}
            sub={formatDate(stats.unrealizedLow?.snapshot_date)}
            tone={
              metricValue(stats.unrealizedLow!, selectedCurrency, "unrealized") >= 0
                ? "bull"
                : "bear"
            }
            size="compact"
          />
        </div>

        {stats.portfolios.length > 0 && (
          <div className="overflow-x-auto border border-border/50">
            <table className="min-w-full text-[12px]">
              <thead className="bg-secondary/25 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">{t("portfolio.portfolio")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.latest")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.peak")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.low")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.pnlHigh")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.pnlLow")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.portfolios.map((row) => (
                  <tr key={row.key} className="border-t border-border/50">
                    <td className="px-3 py-2 uppercase">{row.name}</td>
                    <td className="px-3 py-2 text-right">
                      {currencyFormat(metricValue(row.latest!, selectedCurrency, "market"))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {currencyFormat(metricValue(row.marketHigh!, selectedCurrency, "market"))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {currencyFormat(metricValue(row.marketLow!, selectedCurrency, "market"))}
                    </td>
                    <td className="px-3 py-2 text-right text-bull">
                      {currencyFormat(
                        metricValue(row.unrealizedHigh!, selectedCurrency, "unrealized"),
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-bear">
                      {currencyFormat(
                        metricValue(row.unrealizedLow!, selectedCurrency, "unrealized"),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TerminalCard>
  );
}
