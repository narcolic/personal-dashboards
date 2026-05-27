import { TerminalCard } from "@/components/terminal/TerminalCard";
import { TerminalTable, TerminalTd, TerminalTh } from "@/components/terminal/TerminalTable";
import { fmt, fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import type { Enriched } from "@/lib/portfolio/types";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type RowWithNative = Enriched & { _nativeCurrency: string };
type SortKey =
  | "ticker"
  | "shares"
  | "price"
  | "avg_cost"
  | "dayChangePct"
  | "marketValue"
  | "tx_count"
  | "unrealized"
  | "unrealizedPct";
type SortDirection = "asc" | "desc";

export function PortfolioHoldingsTable({
  rows,
  display,
  convert,
  formatDisplayCurrency,
}: {
  rows: RowWithNative[];
  display: string;
  convert: (amount: number, from: string) => number;
  formatDisplayCurrency: (n: number) => string;
}) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<SortKey>("ticker");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedRows = useMemo(() => {
    const out = rows.slice();
    out.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortKey) {
        case "ticker":
          return a.ticker.localeCompare(b.ticker) * dir;
        case "shares":
          return (a.shares - b.shares) * dir;
        case "price":
          return (a.price - b.price) * dir;
        case "avg_cost":
          return (a.avg_cost - b.avg_cost) * dir;
        case "dayChangePct":
          return (a.dayChangePct - b.dayChangePct) * dir;
        case "marketValue":
          return (convert(a.marketValue, a._nativeCurrency) - convert(b.marketValue, b._nativeCurrency)) * dir;
        case "tx_count":
          return (a.tx_count - b.tx_count) * dir;
        case "unrealized":
          return (convert(a.unrealized, a._nativeCurrency) - convert(b.unrealized, b._nativeCurrency)) * dir;
        case "unrealizedPct":
          return (a.unrealizedPct - b.unrealizedPct) * dir;
      }
    });
    return out;
  }, [convert, rows, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const sortMark = (key: SortKey) => (sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : "");

  return (
    <TerminalCard
      title={t("portfolio.holdings")}
      actions={<span className="text-[10px] text-muted-foreground">{`${rows.length} ${t("portfolio.positions")} · ${display}`}</span>}
    >
      <div className="overflow-x-auto">
        <TerminalTable>
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr className="border-b border-border">
              <TerminalTh className="text-left cursor-pointer select-none" onClick={() => toggleSort("ticker")}>
                {t("portfolio.ticker")}
                {sortMark("ticker")}
              </TerminalTh>
              <TerminalTh className="text-right cursor-pointer select-none" onClick={() => toggleSort("shares")}>
                {t("portfolio.quantity")}
                {sortMark("shares")}
              </TerminalTh>
              <TerminalTh className="text-right cursor-pointer select-none" onClick={() => toggleSort("price")}>
                {t("portfolio.priceCurrent")}
                {sortMark("price")}
              </TerminalTh>
              <TerminalTh className="text-right cursor-pointer select-none" onClick={() => toggleSort("avg_cost")}>
                {t("portfolio.priceAvg")}
                {sortMark("avg_cost")}
              </TerminalTh>
              <TerminalTh className="text-right cursor-pointer select-none" onClick={() => toggleSort("dayChangePct")}>
                {t("portfolio.dayPct")}
                {sortMark("dayChangePct")}
              </TerminalTh>
              <TerminalTh className="text-right cursor-pointer select-none" onClick={() => toggleSort("marketValue")}>
                {t("portfolio.marketValue")} ({display})
                {sortMark("marketValue")}
              </TerminalTh>
              <TerminalTh className="text-right cursor-pointer select-none" onClick={() => toggleSort("tx_count")}>
                {t("portfolio.tx")}
                {sortMark("tx_count")}
              </TerminalTh>
              <TerminalTh className="text-right cursor-pointer select-none" onClick={() => toggleSort("unrealized")}>
                {t("portfolio.unrealized")} ({display})
                {sortMark("unrealized")}
              </TerminalTh>
              <TerminalTh className="text-right cursor-pointer select-none" onClick={() => toggleSort("unrealizedPct")}>
                {t("portfolio.pnlPct")}
                {sortMark("unrealizedPct")}
              </TerminalTh>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => {
              const native = r._nativeCurrency;
              const mvDisp = convert(r.marketValue, native);
              const unrealDisp = convert(r.unrealized, native);
              return (
                <tr key={r.id} className="border-b border-border/60 hover:bg-secondary/40">
                  <td className="py-2 px-2">
                    <div className="font-bold text-primary">{r.ticker}</div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {r.quote?.shortName || r.name || r.asset_type} · {native}
                    </div>
                  </td>
                  <TerminalTd>{fmt(r.shares, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</TerminalTd>
                  <TerminalTd>{fmtCurrency(r.price, native)}</TerminalTd>
                  <TerminalTd>{fmtCurrency(r.avg_cost, native)}</TerminalTd>
                  <TerminalTd tone={r.dayChangePct >= 0 ? "bull" : "bear"}>{fmtPct(r.dayChangePct)}</TerminalTd>
                  <TerminalTd>{formatDisplayCurrency(mvDisp)}</TerminalTd>
                  <TerminalTd>{r.tx_count}</TerminalTd>
                  <TerminalTd tone={r.unrealized >= 0 ? "bull" : "bear"}>{formatDisplayCurrency(unrealDisp)}</TerminalTd>
                  <TerminalTd tone={r.unrealizedPct >= 0 ? "bull" : "bear"}>{fmtPct(r.unrealizedPct)}</TerminalTd>
                </tr>
              );
            })}
          </tbody>
        </TerminalTable>
      </div>
    </TerminalCard>
  );
}
