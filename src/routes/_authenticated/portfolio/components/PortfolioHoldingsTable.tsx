import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { TerminalTable, TerminalTd, TerminalTh } from "@/components/terminal/TerminalTable";
import { fmt, fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import type { Enriched } from "@/lib/portfolio/types";

type RowWithNative = Enriched & { _nativeCurrency: string };
type TableMode = "dashboard" | "holdings";
type SortKey =
  | "ticker"
  | "name"
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
  mode = "dashboard",
  totalCount,
  footer,
  onCardClick,
  title,
  onRowClick,
}: {
  rows: RowWithNative[];
  display: string;
  convert: (amount: number, from: string) => number;
  formatDisplayCurrency: (n: number) => string;
  mode?: TableMode;
  totalCount?: number;
  footer?: ReactNode;
  onCardClick?: () => void;
  title?: string;
  onRowClick?: (row: RowWithNative) => void;
}) {
  const { t } = useTranslation();
  const isDashboardPreview = mode === "dashboard";
  const isHoldingsPage = mode === "holdings";
  const showNameColumn = mode === "holdings";
  const showDayChangeColumn = isDashboardPreview;
  const [sortKey, setSortKey] = useState<SortKey>(isDashboardPreview ? "marketValue" : "ticker");
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    isDashboardPreview || showNameColumn ? "desc" : "asc",
  );

  const sortedRows = useMemo(() => {
    const out = rows.slice();
    out.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortKey) {
        case "ticker":
          return a.ticker.localeCompare(b.ticker) * dir;
        case "name":
          return getRowName(a).localeCompare(getRowName(b)) * dir;
        case "shares":
          return (a.shares - b.shares) * dir;
        case "price":
          return (a.price - b.price) * dir;
        case "avg_cost":
          return (a.avg_cost - b.avg_cost) * dir;
        case "dayChangePct":
          return (a.dayChangePct - b.dayChangePct) * dir;
        case "marketValue":
          return (
            (convert(a.marketValue, a._nativeCurrency) -
              convert(b.marketValue, b._nativeCurrency)) *
            dir
          );
        case "tx_count":
          return (a.tx_count - b.tx_count) * dir;
        case "unrealized":
          return (
            (convert(a.unrealized, a._nativeCurrency) - convert(b.unrealized, b._nativeCurrency)) *
            dir
          );
        case "unrealizedPct":
          return (a.unrealizedPct - b.unrealizedPct) * dir;
      }
    });
    return out;
  }, [convert, rows, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const sortMark = (key: SortKey) => (sortKey !== key ? "" : sortDirection === "asc" ? " ↑" : " ↓");
  const positionsLabel = isHoldingsPage
    ? t("portfolio.showingHoldings", {
        shown: rows.length,
        total: totalCount ?? rows.length,
      })
    : totalCount && totalCount !== rows.length
      ? `${rows.length} / ${totalCount} ${t("portfolio.positions")}`
      : `${rows.length} ${t("portfolio.positions")}`;

  return (
    <TerminalCard
      title={title ?? t("portfolio.holdings")}
      actions={<span className="text-xs text-muted-foreground">{positionsLabel}</span>}
      onClick={onCardClick}
      bodyClassName="p-2 md:p-3"
    >
      <div onClick={(event) => event.stopPropagation()}>
        <div className="space-y-2 md:hidden">
          {sortedRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
              {t("common.noData")}
            </div>
          ) : (
            sortedRows.map((row) => {
              const nativeCurrency = row._nativeCurrency;
              const marketValue = isHoldingsPage
                ? fmtCurrency(row.marketValue, nativeCurrency)
                : formatDisplayCurrency(convert(row.marketValue, nativeCurrency));
              const unrealizedValue = isHoldingsPage
                ? fmtCurrency(Math.abs(row.unrealized), nativeCurrency)
                : formatDisplayCurrency(Math.abs(convert(row.unrealized, nativeCurrency)));
              const positive = row.unrealized >= 0;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => onRowClick?.(row)}
                  disabled={!onRowClick}
                  className="w-full rounded-lg border border-border/70 bg-background/45 p-4 text-left shadow-[0_12px_32px_-28px_rgba(0,0,0,0.9)] transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-primary/60 enabled:hover:bg-secondary/20 enabled:focus-visible:outline-none enabled:focus-visible:ring-1 enabled:focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-primary">{row.ticker}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {getRowName(row)} · {nativeCurrency}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">{marketValue}</div>
                      <div
                        className={`mt-1 text-xs tabular-nums ${positive ? "text-bull" : "text-bear"}`}
                      >
                        {positive ? "▲ +" : "▼ −"}
                        {unrealizedValue} · {fmtPct(Math.abs(row.unrealizedPct))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    <span>
                      {fmt(row.shares, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{" "}
                      {t("portfolio.shares")}
                    </span>
                    <span>
                      {row.tx_count} {t("portfolio.tx")}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="hidden md:block">
          <TerminalTable>
            <thead className="bg-secondary/25 text-xs uppercase tracking-[0.1em] text-muted-foreground">
              <tr className="border-b border-border">
                <TerminalTh
                  className="text-left cursor-pointer select-none"
                  onClick={() => toggleSort("ticker")}
                >
                  {t("portfolio.ticker")}
                  {sortMark("ticker")}
                </TerminalTh>
                {showNameColumn ? (
                  <TerminalTh
                    className="text-left cursor-pointer select-none"
                    onClick={() => toggleSort("name")}
                  >
                    {t("portfolio.name")}
                    {sortMark("name")}
                  </TerminalTh>
                ) : null}
                {!isDashboardPreview ? (
                  <>
                    <TerminalTh
                      className="text-right cursor-pointer select-none"
                      onClick={() => toggleSort("shares")}
                    >
                      {t("portfolio.quantity")}
                      {sortMark("shares")}
                    </TerminalTh>
                    <TerminalTh
                      className="text-right cursor-pointer select-none"
                      onClick={() => toggleSort("price")}
                    >
                      {t("portfolio.priceCurrent")}
                      {sortMark("price")}
                    </TerminalTh>
                    <TerminalTh
                      className="text-right cursor-pointer select-none"
                      onClick={() => toggleSort("avg_cost")}
                    >
                      {t("portfolio.priceAvg")}
                      {sortMark("avg_cost")}
                    </TerminalTh>
                  </>
                ) : null}
                {showDayChangeColumn ? (
                  <TerminalTh
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort("dayChangePct")}
                  >
                    {t("portfolio.dayPct")}
                    {sortMark("dayChangePct")}
                  </TerminalTh>
                ) : null}
                <TerminalTh
                  className="text-right cursor-pointer select-none"
                  onClick={() => toggleSort("marketValue")}
                >
                  {t("portfolio.marketValue")}
                  {!isHoldingsPage ? ` (${display})` : ""}
                  {sortMark("marketValue")}
                </TerminalTh>
                {!isDashboardPreview ? (
                  <TerminalTh
                    className="text-right cursor-pointer select-none"
                    onClick={() => toggleSort("tx_count")}
                  >
                    {t("portfolio.tx")}
                    {sortMark("tx_count")}
                  </TerminalTh>
                ) : null}
                <TerminalTh
                  className="text-right cursor-pointer select-none"
                  onClick={() => toggleSort("unrealized")}
                >
                  {t("portfolio.unrealized")}
                  {!isHoldingsPage ? ` (${display})` : ""}
                  {sortMark("unrealized")}
                </TerminalTh>
                <TerminalTh
                  className="text-right cursor-pointer select-none"
                  onClick={() => toggleSort("unrealizedPct")}
                >
                  {t("portfolio.pnlPct")}
                  {sortMark("unrealizedPct")}
                </TerminalTh>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const nativeCurrency = row._nativeCurrency;
                const marketValue = convert(row.marketValue, nativeCurrency);
                const unrealized = convert(row.unrealized, nativeCurrency);
                const marketValueLabel = isHoldingsPage
                  ? fmtCurrency(row.marketValue, nativeCurrency)
                  : formatDisplayCurrency(marketValue);
                const unrealizedLabel = isHoldingsPage
                  ? fmtCurrency(row.unrealized, nativeCurrency)
                  : formatDisplayCurrency(unrealized);

                return (
                  <tr
                    key={row.id}
                    onClick={
                      onRowClick
                        ? (event) => {
                            event.stopPropagation();
                            onRowClick(row);
                          }
                        : undefined
                    }
                    className={`border-b border-border/50 transition-colors last:border-b-0 hover:bg-secondary/30 ${
                      onRowClick ? "cursor-pointer" : ""
                    }`}
                  >
                    <td className="px-3 py-3 text-left">
                      <div className="font-bold text-primary">{row.ticker}</div>
                      {showNameColumn ? (
                        <div className="text-xs text-muted-foreground">{nativeCurrency}</div>
                      ) : (
                        <div className="max-w-[180px] truncate text-xs text-muted-foreground">
                          {getRowName(row)} | {nativeCurrency}
                        </div>
                      )}
                    </td>
                    {showNameColumn ? (
                      <td className="px-3 py-3 text-left">
                        <div className="truncate max-w-[260px]">{getRowName(row)}</div>
                      </td>
                    ) : null}
                    {!isDashboardPreview ? (
                      <>
                        <TerminalTd>
                          {fmt(row.shares, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        </TerminalTd>
                        <TerminalTd>{fmtCurrency(row.price, nativeCurrency)}</TerminalTd>
                        <TerminalTd>{fmtCurrency(row.avg_cost, nativeCurrency)}</TerminalTd>
                      </>
                    ) : null}
                    {showDayChangeColumn ? (
                      <TerminalTd tone={row.dayChangePct >= 0 ? "bull" : "bear"}>
                        {fmtPct(row.dayChangePct)}
                      </TerminalTd>
                    ) : null}
                    <TerminalTd>{marketValueLabel}</TerminalTd>
                    {!isDashboardPreview ? <TerminalTd>{row.tx_count}</TerminalTd> : null}
                    <TerminalTd tone={row.unrealized >= 0 ? "bull" : "bear"}>
                      {unrealizedLabel}
                    </TerminalTd>
                    <TerminalTd tone={row.unrealizedPct >= 0 ? "bull" : "bear"}>
                      {fmtPct(row.unrealizedPct)}
                    </TerminalTd>
                  </tr>
                );
              })}
            </tbody>
          </TerminalTable>
        </div>
      </div>
      {footer ? (
        <div className="mt-3 flex justify-end" onClick={(event) => event.stopPropagation()}>
          {footer}
        </div>
      ) : null}
    </TerminalCard>
  );
}

function getRowName(row: RowWithNative) {
  return row.quote?.shortName || row.name || row.asset_type;
}
