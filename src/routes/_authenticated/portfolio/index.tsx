import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { classifyHolding } from "@/lib/portfolio/transactions/mappers";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import type { Enriched } from "@/lib/portfolio/types";
import { PortfolioSummary } from "@/routes/_authenticated/portfolio/components/PortfolioSummary";
import { PortfolioChart } from "@/routes/_authenticated/portfolio/components/PortfolioChart";
import { PortfolioHoldingsTable } from "@/routes/_authenticated/portfolio/components/PortfolioHoldingsTable";
import { usePortfolioData } from "@/routes/_authenticated/portfolio/hooks/usePortfolioData";
import { useQuotes } from "@/routes/_authenticated/portfolio/hooks/useQuotes";
import { useTransactionsFilters } from "@/routes/_authenticated/portfolio/hooks/useTransactionsFilters";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_authenticated/portfolio/")({ component: Dashboard });

type ConvFn = (amt: number, from: string) => number;
type RowWithNative = Enriched & { _nativeCurrency: string };

function Dashboard() {
  const { t } = useTranslation();
  const { txQ, portfoliosQ, transactions } = usePortfolioData();
  const { positions, enrichedRows } = useQuotes(transactions, {
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  const transactionCurrencies = useMemo(() => {
    const s = new Set<string>();
    for (const p of positions) {
      const c = (p.currency || "").toUpperCase();
      if (c) s.add(c);
    }
    return s.size ? [...s].sort() : ["USD"];
  }, [positions]);

  const fxWanted = useMemo(
    () => Array.from(new Set(["USD", "EUR", ...transactionCurrencies])).sort(),
    [transactionCurrencies],
  );

  const fxQ = useQuery({
    queryKey: ["fx-rates", fxWanted.join(",")],
    queryFn: async () => {
      const wanted = Array.from(new Set(fxWanted.map((c) => c.toUpperCase())));
      const toUsdPerUnit = (allRates: Record<string, number>) => {
        const rates: Record<string, number> = { USD: 1 };
        for (const c of wanted) {
          if (c === "USD") continue;
          const usdToC = Number(allRates[c]);
          if (Number.isFinite(usdToC) && usdToC > 0) rates[c] = 1 / usdToC;
        }
        return rates;
      };
      try {
        const response = await fetch("/api/fx-rates?from=USD");
        if (response.ok) {
          const data = (await response.json()) as { rates?: Record<string, number> };
          if (data.rates) return { rates: toUsdPerUnit(data.rates) };
        }
      } catch {}
      return { rates: { USD: 1, EUR: 1 } };
    },
    staleTime: 10 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });

  const rates = useMemo<Record<string, number>>(() => fxQ.data?.rates ?? { USD: 1 }, [fxQ.data]);
  const convRows = useMemo(
    () =>
      enrichedRows.map((r) => ({
        ...r,
        _nativeCurrency: (r.quote?.currency ?? r.currency ?? "USD").toUpperCase(),
      })),
    [enrichedRows],
  );

  const {
    selected,
    setSelected,
    display,
    setDisplay,
    rows,
    displayCurrencies,
    allId,
    unassignedId,
  } = useTransactionsFilters({ allRows: convRows, transactionCurrencies });

  const convert = useMemo(() => {
    const dispRate = rates[display] ?? 1;
    return (amount: number, from: string) => {
      const f = (from || "USD").toUpperCase();
      const fromRate = rates[f] ?? 1;
      if (!fromRate || !dispRate) return amount;
      return (amount * fromRate) / dispRate;
    };
  }, [rates, display]);

  const portfolioMap = useMemo(
    () => new Map((portfoliosQ.data ?? []).map((p) => [p.id, p.name])),
    [portfoliosQ.data],
  );
  const totals = useMemo(() => computeTotals(rows, convert), [rows, convert]);

  const byPortfolio = useMemo(() => {
    const groups = new Map<string, typeof convRows>();
    for (const r of convRows) {
      const key = r.portfolio_id ?? unassignedId;
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }
    return Array.from(groups, ([id, items]) => {
      const t0 = computeTotals(items, convert);
      return {
        id,
        name: id === unassignedId ? t("portfolio.unassigned") : (portfolioMap.get(id) ?? "-"),
        count: items.length,
        ...t0,
      };
    }).sort((a, b) => b.mv - a.mv);
  }, [convRows, portfolioMap, convert, unassignedId, t]);

  const byType = useMemo(() => groupSum(rows, (r) => r.asset_type, convert), [rows, convert]);
  const regionHoldings = useMemo(() => rows.map(classifyHolding), [rows]);
  const byRegion = useMemo(() => {
    const m = new Map<string, number>();
    for (const [index, r] of rows.entries()) {
      const region = regionHoldings[index]?.regionCategory ?? t("portfolio.unknown");
      m.set(region, (m.get(region) ?? 0) + convert(r.marketValue, r._nativeCurrency));
    }
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [rows, convert, regionHoldings, t]);

  const byCurrency = useMemo(
    () => groupSumNative(rows, (r) => r._nativeCurrency || t("portfolio.unknown")),
    [rows, t],
  );

  if (txQ.isLoading) return <Skeleton />;
  if ((txQ.data ?? []).length === 0) return <EmptyState />;

  const tabs = [
    { id: allId, label: t("portfolio.all") },
    ...byPortfolio.map((g) => ({ id: g.id, label: g.name.toUpperCase() })),
  ];
  const dispFmt = (n: number) => fmtCurrency(n, display);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-3 md:items-stretch">
        <div className="border border-border bg-card overflow-x-auto flex-1">
          <div className="flex text-[11px] uppercase tracking-[0.2em]">
            {tabs.map((tab) => {
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
          {displayCurrencies.map((c) => (
            <button
              key={c}
              onClick={() => setDisplay(c)}
              className={`px-4 text-[11px] uppercase tracking-[0.2em] border-r border-border last:border-r-0 ${display === c ? "bg-primary text-primary-foreground font-bold" : "hover:text-primary"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <PortfolioSummary
        selectedAll={selected === allId}
        display={display}
        totals={totals}
        formatCurrency={dispFmt}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PortfolioChart
          title={t("portfolio.allocationByType")}
          data={byType}
          total={totals.mv}
          chart="pie"
          display={display}
        />
        <PortfolioChart
          title={t("portfolio.allocationByRegion")}
          data={byRegion}
          total={totals.mv}
          chart="bar"
          display={display}
        />
        <PortfolioChart
          title={t("portfolio.allocationByCurrency")}
          data={byCurrency}
          total={byCurrency.reduce((sum, item) => sum + item.value, 0)}
          chart="pie"
          display={display}
          formatter={(value, currency) => fmtCurrency(value, currency)}
        />
      </div>

      <PortfolioHoldingsTable
        rows={rows}
        display={display}
        convert={convert}
        formatDisplayCurrency={dispFmt}
      />
    </div>
  );
}

function computeTotals(rows: RowWithNative[], convert: ConvFn) {
  let mv = 0,
    cost = 0,
    dayChange = 0;
  for (const r of rows) {
    const cur = r._nativeCurrency;
    mv += convert(r.marketValue, cur);
    cost += convert(r.costBasis, cur);
    dayChange += convert(r.dayChange, cur);
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

function groupSum(rows: RowWithNative[], key: (r: RowWithNative) => string, convert: ConvFn) {
  const m = new Map<string, number>();
  for (const r of rows)
    m.set(key(r), (m.get(key(r)) ?? 0) + convert(r.marketValue, r._nativeCurrency));
  return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function groupSumNative(rows: RowWithNative[], key: (r: RowWithNative) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.marketValue);
  return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 border border-border bg-card animate-pulse" />
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
