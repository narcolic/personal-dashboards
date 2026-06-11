import { useMemo, useState } from "react";
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

export function PortfolioSnapshotStats({ defaultCurrency }: { defaultCurrency: string }) {
  const { t } = useTranslation();
  const snapshotsQ = usePortfolioSnapshots();
  const [currency, setCurrency] = useState<SnapshotCurrency>(
    defaultCurrency.toUpperCase() === "USD" ? "USD" : "EUR",
  );

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
      marketHigh: extreme(totalRows, currency, "market", "high"),
      marketLow: extreme(totalRows, currency, "market", "low"),
      unrealizedHigh: extreme(totalRows, currency, "unrealized", "high"),
      unrealizedLow: extreme(totalRows, currency, "unrealized", "low"),
      portfolios: Array.from(portfolioGroups.values())
        .map((group) => ({
          key: group[0]?.scope_key ?? "",
          name: group[0]?.portfolio_name ?? t("portfolio.unassigned"),
          latest: latest(group),
          marketHigh: extreme(group, currency, "market", "high"),
          marketLow: extreme(group, currency, "market", "low"),
          unrealizedHigh: extreme(group, currency, "unrealized", "high"),
          unrealizedLow: extreme(group, currency, "unrealized", "low"),
        }))
        .sort(
          (a, b) =>
            metricValue(b.latest ?? b.marketHigh ?? b.marketLow!, currency, "market") -
            metricValue(a.latest ?? a.marketHigh ?? a.marketLow!, currency, "market"),
        ),
    };
  }, [currency, snapshotsQ.data, t]);

  const actions = (
    <div className="flex border border-border">
      {(["EUR", "USD"] as const).map((option) => (
        <button
          key={option}
          onClick={() => setCurrency(option)}
          className={`px-3 py-1 text-[10px] uppercase tracking-[0.2em] border-r border-border last:border-r-0 ${
            currency === option
              ? "bg-primary text-primary-foreground font-bold"
              : "hover:text-primary"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );

  if (snapshotsQ.isLoading) {
    return (
      <TerminalCard title={t("portfolio.snapshotHistory")} actions={actions}>
        <div className="h-24 animate-pulse bg-secondary/40" />
      </TerminalCard>
    );
  }

  if (!stats.latestTotal) {
    return (
      <TerminalCard title={t("portfolio.snapshotHistory")} actions={actions}>
        <div className="text-xs text-muted-foreground">{t("portfolio.noSnapshotsYet")}</div>
      </TerminalCard>
    );
  }

  const currencyFormat = (value: number) => fmtCurrency(value, currency);

  return (
    <TerminalCard title={t("portfolio.snapshotHistory")} actions={actions}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard
            label={t("portfolio.latestSnapshot")}
            value={currencyFormat(metricValue(stats.latestTotal, currency, "market"))}
            sub={formatDate(stats.latestTotal.snapshot_date)}
            accent
          />
          <StatCard
            label={t("portfolio.peakValue")}
            value={currencyFormat(metricValue(stats.marketHigh!, currency, "market"))}
            sub={formatDate(stats.marketHigh?.snapshot_date)}
          />
          <StatCard
            label={t("portfolio.lowValue")}
            value={currencyFormat(metricValue(stats.marketLow!, currency, "market"))}
            sub={formatDate(stats.marketLow?.snapshot_date)}
          />
          <StatCard
            label={t("portfolio.peakUnrealized")}
            value={currencyFormat(metricValue(stats.unrealizedHigh!, currency, "unrealized"))}
            sub={formatDate(stats.unrealizedHigh?.snapshot_date)}
            tone={metricValue(stats.unrealizedHigh!, currency, "unrealized") >= 0 ? "bull" : "bear"}
          />
          <StatCard
            label={t("portfolio.lowUnrealized")}
            value={currencyFormat(metricValue(stats.unrealizedLow!, currency, "unrealized"))}
            sub={formatDate(stats.unrealizedLow?.snapshot_date)}
            tone={metricValue(stats.unrealizedLow!, currency, "unrealized") >= 0 ? "bull" : "bear"}
          />
        </div>

        {stats.portfolios.length > 0 && (
          <div className="overflow-x-auto border border-border">
            <table className="min-w-full text-[12px]">
              <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
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
                  <tr key={row.key} className="border-t border-border">
                    <td className="px-3 py-2 uppercase">{row.name}</td>
                    <td className="px-3 py-2 text-right">
                      {currencyFormat(metricValue(row.latest!, currency, "market"))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {currencyFormat(metricValue(row.marketHigh!, currency, "market"))}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {currencyFormat(metricValue(row.marketLow!, currency, "market"))}
                    </td>
                    <td className="px-3 py-2 text-right text-bull">
                      {currencyFormat(metricValue(row.unrealizedHigh!, currency, "unrealized"))}
                    </td>
                    <td className="px-3 py-2 text-right text-bear">
                      {currencyFormat(metricValue(row.unrealizedLow!, currency, "unrealized"))}
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
