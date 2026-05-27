import { useMemo, useState } from "react";
import type { Enriched } from "@/lib/portfolio/types";

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";

type RowWithNative = Enriched & { _nativeCurrency: string };

function mergeRowsForAllPortfolios(rows: RowWithNative[]) {
  const groups = new Map<string, RowWithNative[]>();
  for (const row of rows) {
    const key = `${row.ticker.toUpperCase()}|${(row.currency || "").toUpperCase()}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  return Array.from(groups.values()).map((items) => {
    if (items.length === 1) return items[0];

    const first = items[0];
    const shares = items.reduce((sum, item) => sum + Number(item.shares), 0);
    const costBasis = items.reduce((sum, item) => sum + Number(item.costBasis), 0);
    const marketValue = items.reduce((sum, item) => sum + Number(item.marketValue), 0);
    const dayChange = items.reduce((sum, item) => sum + Number(item.dayChange), 0);
    const txCount = items.reduce((sum, item) => sum + Number(item.tx_count), 0);
    const avgCost = shares ? costBasis / shares : 0;
    const price = shares ? marketValue / shares : Number(first.price);
    const prevClose = shares ? (marketValue - dayChange) / shares : Number(first.prevClose);
    const unrealized = marketValue - costBasis;

    return {
      ...first,
      id: `${first.ticker.toUpperCase()}|ALL|${(first.currency || "").toUpperCase()}`,
      portfolio_id: null,
      shares,
      avg_cost: avgCost,
      price,
      prevClose,
      dayChange,
      dayChangePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
      marketValue,
      costBasis,
      unrealized,
      unrealizedPct: costBasis ? (unrealized / costBasis) * 100 : 0,
      tx_count: txCount,
      first_date: items.reduce(
        (min, item) => (item.first_date < min ? item.first_date : min),
        first.first_date,
      ),
      last_date: items.reduce(
        (max, item) => (item.last_date > max ? item.last_date : max),
        first.last_date,
      ),
    };
  });
}

export function useTransactionsFilters({
  allRows,
  transactionCurrencies,
}: {
  allRows: RowWithNative[];
  transactionCurrencies: string[];
}) {
  const [selected, setSelected] = useState<string>(ALL);
  const [display, setDisplay] = useState<string>("EUR");

  const rows = useMemo(() => {
    if (selected === ALL) return mergeRowsForAllPortfolios(allRows);
    if (selected === UNASSIGNED) return allRows.filter((r) => !r.portfolio_id);
    return allRows.filter((r) => r.portfolio_id === selected);
  }, [allRows, selected]);

  const displayCurrencies = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const c = (r.currency || "").toUpperCase();
      if (c) s.add(c);
    }
    if (s.size === 0) {
      for (const c of transactionCurrencies) s.add(c);
    }
    return [...s].sort();
  }, [rows, transactionCurrencies]);

  const validDisplay = useMemo(
    () => (displayCurrencies.includes(display) ? display : (displayCurrencies[0] ?? "USD")),
    [display, displayCurrencies],
  );

  return {
    selected,
    setSelected,
    display: validDisplay,
    setDisplay,
    rows,
    displayCurrencies,
    allId: ALL,
    unassignedId: UNASSIGNED,
  };
}
