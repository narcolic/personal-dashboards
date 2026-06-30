import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { TerminalTable } from "@/components/terminal/TerminalTable";
import { fmt, fmtCurrency } from "@/lib/portfolio/formatters";
import { classifyHolding } from "@/lib/portfolio/transactions/mappers";
import { PortfolioChart } from "@/routes/_authenticated/portfolio/components/PortfolioChart";
import { PortfolioHoldingsTable } from "@/routes/_authenticated/portfolio/components/PortfolioHoldingsTable";
import { PortfolioSnapshotStats } from "@/routes/_authenticated/portfolio/components/PortfolioSnapshotStats";
import { PortfolioSummary } from "@/routes/_authenticated/portfolio/components/PortfolioSummary";
import {
  type RowWithNative,
  usePortfolioHoldingsView,
} from "@/routes/_authenticated/portfolio/hooks/usePortfolioHoldingsView";

export const Route = createFileRoute("/_authenticated/portfolio/")({ component: Overview });

type ConvFn = (amt: number, from: string) => number;

function Overview() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    txQ,
    transactions,
    rows,
    display,
    setDisplay,
    displayCurrencies,
    selected,
    setSelected,
    portfolioTabs,
    convert,
  } = usePortfolioHoldingsView();

  const totals = useMemo(() => computeTotals(rows, convert), [rows, convert]);
  const byType = useMemo(() => groupSum(rows, (row) => row.asset_type, convert), [rows, convert]);
  const regionHoldings = useMemo(() => rows.map(classifyHolding), [rows]);
  const byRegion = useMemo(() => {
    const totalsByRegion = new Map<string, number>();
    for (const [index, row] of rows.entries()) {
      const region = regionHoldings[index]?.regionCategory ?? t("portfolio.unknown");
      totalsByRegion.set(
        region,
        (totalsByRegion.get(region) ?? 0) + convert(row.marketValue, row._nativeCurrency),
      );
    }
    return Array.from(totalsByRegion, ([name, value]) => ({ name, value })).sort(
      (a, b) => b.value - a.value,
    );
  }, [rows, convert, regionHoldings, t]);

  const byCurrency = useMemo(
    () => groupSumNative(rows, (row) => row._nativeCurrency || t("portfolio.unknown")),
    [rows, t],
  );
  const holdingsPreviewRows = useMemo(
    () =>
      rows
        .slice()
        .sort(
          (a, b) =>
            convert(b.marketValue, b._nativeCurrency) - convert(a.marketValue, a._nativeCurrency),
        )
        .slice(0, 5),
    [rows, convert],
  );
  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  if (txQ.isLoading) return <Skeleton />;
  if (transactions.length === 0) return <EmptyState />;

  const formatDisplayCurrency = (value: number) => fmtCurrency(value, display);
  const goToPerformance = () => {
    router.navigate({ to: "/portfolio/pnl" });
  };
  const goToHoldings = () => {
    router.navigate({ to: "/portfolio/holdings" });
  };
  const goToHoldingDetails = (ticker: string) => {
    router.navigate({ to: "/portfolio/holdings/$ticker", params: { ticker } });
  };
  const goToHoldingsWithAllocation = (
    allocationKind: "assetType" | "region" | "currency",
    allocationValue: string,
  ) => {
    router.navigate({
      to: "/portfolio/holdings",
      search: { allocationKind, allocationValue },
    });
  };
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-3 md:items-stretch">
        <div className="border border-border bg-card overflow-x-auto flex-1">
          <div className="flex text-[11px] uppercase tracking-[0.2em]">
            {portfolioTabs.map((tab) => {
              const active = selected === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelected(tab.id)}
                  className={`px-4 py-2 border-r border-border whitespace-nowrap ${active ? "bg-primary text-primary-foreground font-bold" : "hover:text-primary"}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="border border-border bg-card flex">
          {displayCurrencies.map((currency) => (
            <button
              key={currency}
              onClick={() => setDisplay(currency)}
              className={`px-4 text-[11px] uppercase tracking-[0.2em] border-r border-border last:border-r-0 ${display === currency ? "bg-primary text-primary-foreground font-bold" : "hover:text-primary"}`}
            >
              {currency}
            </button>
          ))}
        </div>
      </div>

      <OverviewSection title={t("portfolio.summarySection")}>
        <PortfolioSummary
          selectedAll={selected === portfolioTabs[0]?.id}
          display={display}
          totals={totals}
          formatCurrency={formatDisplayCurrency}
          onUnrealizedClick={goToPerformance}
        />
      </OverviewSection>

      <OverviewSection title={t("portfolio.snapshotSection")} id="overview-snapshot-section">
        <PortfolioSnapshotStats currency={display} title="" />
      </OverviewSection>

      <OverviewSection title={t("portfolio.allocationSection")}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <PortfolioChart
              title={t("portfolio.allocationByType")}
              data={byType}
              total={totals.mv}
              chart="pie"
              display={display}
              onItemClick={(name) => goToHoldingsWithAllocation("assetType", name)}
            />
            <PortfolioChart
              title={t("portfolio.allocationByCurrency")}
              data={byCurrency}
              total={byCurrency.reduce((sum, item) => sum + item.value, 0)}
              chart="pie"
              display={display}
              formatter={(value, currency) => fmtCurrency(value, currency)}
              onItemClick={(name) => goToHoldingsWithAllocation("currency", name)}
            />
          </div>
          <PortfolioChart
            title={t("portfolio.allocationByRegion")}
            data={byRegion}
            total={totals.mv}
            chart="bar"
            display={display}
            chartHeight={240}
            onItemClick={(name) => goToHoldingsWithAllocation("region", name)}
          />
        </div>
      </OverviewSection>

      <OverviewSection title={t("portfolio.holdingsSection")}>
        <PortfolioHoldingsTable
          rows={holdingsPreviewRows}
          display={display}
          convert={convert}
          formatDisplayCurrency={formatDisplayCurrency}
          mode="dashboard"
          totalCount={rows.length}
          onCardClick={goToHoldings}
          title=""
          onRowClick={(row) => goToHoldingDetails(row.ticker)}
        />
      </OverviewSection>

      {recentTransactions.length > 0 ? (
        <OverviewSection title={t("portfolio.recentTransactionsSection")}>
          <TerminalCard bodyClassName="p-0">
            <TerminalTable>
              <thead className="bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">{t("portfolio.date")}</th>
                  <th className="px-3 py-2 text-left">{t("portfolio.ticker")}</th>
                  <th className="px-3 py-2 text-left">{t("portfolio.portfolio")}</th>
                  <th className="px-3 py-2 text-left">{t("portfolio.action")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.shares")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.price")}</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-t border-border/60 text-[12px] hover:bg-secondary/30"
                  >
                    <td className="px-3 py-2 tabular-nums">{transaction.transaction_date}</td>
                    <td className="px-3 py-2 font-bold text-primary">{transaction.ticker}</td>
                    <td className="px-3 py-2">
                      {portfolioName(transaction.portfolio_id, portfolioTabs, t)}
                    </td>
                    <td className="px-3 py-2 uppercase">
                      {t(`portfolio.action${capitalizeAction(transaction.action ?? "buy")}`)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmt(Number(transaction.shares), {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 4,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtCurrency(
                        Number(transaction.price),
                        (transaction.currency || "USD").toUpperCase(),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TerminalTable>
          </TerminalCard>
        </OverviewSection>
      ) : null}
    </div>
  );
}

function OverviewSection({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section className="space-y-3" id={id}>
      <h2 className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-foreground">
        <span className="text-primary">&gt;</span>
        <span className="text-muted-foreground">{title}</span>
      </h2>
      {children}
    </section>
  );
}

function computeTotals(rows: RowWithNative[], convert: ConvFn) {
  let mv = 0;
  let cost = 0;
  let dayChange = 0;
  for (const row of rows) {
    const currency = row._nativeCurrency;
    mv += convert(row.marketValue, currency);
    cost += convert(row.costBasis, currency);
    dayChange += convert(row.dayChange, currency);
  }
  const unrealized = mv - cost;
  return {
    mv,
    cost,
    dayChange,
    unrealized,
    dayPct: mv - dayChange ? (dayChange / (mv - dayChange)) * 100 : 0,
    unrealizedPct: cost ? (unrealized / cost) * 100 : 0,
  };
}

function groupSum(rows: RowWithNative[], key: (row: RowWithNative) => string, convert: ConvFn) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(
      key(row),
      (totals.get(key(row)) ?? 0) + convert(row.marketValue, row._nativeCurrency),
    );
  }
  return Array.from(totals, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function groupSumNative(rows: RowWithNative[], key: (row: RowWithNative) => string) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(key(row), (totals.get(key(row)) ?? 0) + row.marketValue);
  }
  return Array.from(totals, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function portfolioName(
  portfolioId: string | null,
  portfolioTabs: Array<{ id: string; label: string }>,
  t: ReturnType<typeof useTranslation>["t"],
) {
  if (!portfolioId) return t("portfolio.unassigned");
  return portfolioTabs.find((tab) => tab.id === portfolioId)?.label ?? "-";
}

function capitalizeAction(action: string) {
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-24 border border-border bg-card animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="border border-dashed border-border p-12 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] text-primary">
        {t("portfolio.noTransactions")}
      </div>
      <h2 className="mt-3 text-2xl">{t("portfolio.emptyPortfolio")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("portfolio.addFirstTransaction")}</p>
      <Link
        to="/portfolio/transactions"
        className="inline-block mt-6 bg-primary text-primary-foreground px-6 py-2 text-xs uppercase tracking-[0.25em] font-bold hover:opacity-90"
      >
        {t("portfolio.addTransaction")}
      </Link>
    </div>
  );
}
