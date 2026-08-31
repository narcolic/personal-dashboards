import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { TerminalTable } from "@/components/terminal/TerminalTable";
import { fmtCurrency } from "@/lib/portfolio/formatters";

type TransactionInputType = import("@/lib/portfolio/transactions/api").TransactionInputType;

type TransactionTableRow = {
  id: string;
  ticker: string;
  action?: TransactionInputType["action"];
  name: string | null;
  asset_type: string;
  currency: string;
  shares: number;
  price: number;
  transaction_date: string;
  notes: string | null;
  portfolio_id: string | null;
  security_listing_id: string;
};

type SortKey =
  | "transaction_date"
  | "ticker"
  | "portfolio"
  | "asset_type"
  | "shares"
  | "price"
  | "total";
type SortDirection = "asc" | "desc";

export function TransactionsTable({
  data,
  isLoading,
  selected,
  setSelected,
  portfolioName,
  setEditing,
  onDelete,
}: {
  data: TransactionTableRow[];
  isLoading: boolean;
  selected: Set<string>;
  setSelected: Dispatch<SetStateAction<Set<string>>>;
  portfolioName: (id: string | null) => string;
  setEditing: Dispatch<SetStateAction<(TransactionInputType & { id?: string }) | null>>;
  onDelete: (id: string, ticker: string, transactionDate: string) => void;
}) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<SortKey>("transaction_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sortedRows = useMemo(() => {
    const rows = data.slice();
    rows.sort((left, right) => {
      const getValue = (row: TransactionTableRow) => {
        switch (sortKey) {
          case "transaction_date":
            return row.transaction_date;
          case "ticker":
            return row.ticker;
          case "portfolio":
            return portfolioName(row.portfolio_id);
          case "asset_type":
            return row.asset_type;
          case "shares":
            return Number(row.shares);
          case "price":
            return Number(row.price);
          case "total":
            return Number(row.shares) * Number(row.price);
        }
      };
      const leftValue = getValue(left);
      const rightValue = getValue(right);
      const direction = sortDirection === "asc" ? 1 : -1;
      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }
      return String(leftValue).localeCompare(String(rightValue)) * direction;
    });
    return rows;
  }, [data, portfolioName, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };
  const sortMark = (key: SortKey) => (sortKey !== key ? "" : sortDirection === "asc" ? " ↑" : " ↓");
  const editTransaction = (position: TransactionTableRow) => {
    setEditing({
      id: position.id,
      ticker: position.ticker,
      action: position.action ?? "buy",
      name: position.name ?? "",
      asset_type: position.asset_type as TransactionInputType["asset_type"],
      currency: position.currency,
      shares: Number(position.shares),
      price: Number(position.price),
      transaction_date: position.transaction_date,
      notes: position.notes ?? "",
      portfolio_id: position.portfolio_id ?? null,
      security_listing_id: position.security_listing_id,
    });
  };

  return (
    <>
      <div className="space-y-2 md:hidden">
        {isLoading ? <MobileMessage>{t("common.loading")}</MobileMessage> : null}
        {!isLoading && sortedRows.length === 0 ? (
          <MobileMessage>{t("portfolio.noTransactionsYet")}</MobileMessage>
        ) : null}
        {sortedRows.map((position) => (
          <article
            key={position.id}
            className="analytics-panel rounded-[10px] border border-border/70 bg-card/80 p-3 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2.5">
                <input
                  type="checkbox"
                  aria-label={`${t("portfolio.selectTransaction")} ${position.ticker}`}
                  checked={selected.has(position.id)}
                  onChange={(event) =>
                    setSelected((previous) =>
                      toggleSelection(previous, position.id, event.target.checked),
                    )
                  }
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <div className="min-w-0">
                  <div className="font-bold text-primary">{position.ticker}</div>
                  <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                    {position.transaction_date} · {portfolioName(position.portfolio_id)}
                  </div>
                </div>
              </div>
              <RowActions
                onEdit={() => editTransaction(position)}
                onDelete={() => onDelete(position.id, position.ticker, position.transaction_date)}
              />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border/50 pt-2 text-[11px]">
              <MobileValue label={t("portfolio.action")} value={position.action ?? "buy"} />
              <MobileValue
                label={t("portfolio.shares")}
                value={String(Number(position.shares))}
                align="right"
              />
              <MobileValue
                label={t("portfolio.total")}
                value={fmtCurrency(
                  Number(position.shares) * Number(position.price),
                  position.currency,
                )}
                align="right"
              />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block">
        <TerminalTable variant="panel">
          <thead className="border-b border-border/60 bg-secondary/25 text-xs uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-center">
                <input
                  type="checkbox"
                  aria-label={t("portfolio.selectAllTransactions")}
                  checked={data.length > 0 && selected.size === data.length}
                  onChange={(event) => {
                    if (event.target.checked) setSelected(new Set(sortedRows.map((row) => row.id)));
                    else setSelected(new Set());
                  }}
                  className="accent-primary"
                />
              </th>
              <SortableHeading
                label={t("portfolio.date")}
                mark={sortMark("transaction_date")}
                onClick={() => toggleSort("transaction_date")}
              />
              <SortableHeading
                label={t("portfolio.ticker")}
                mark={sortMark("ticker")}
                onClick={() => toggleSort("ticker")}
              />
              <SortableHeading
                label={t("portfolio.portfolio")}
                mark={sortMark("portfolio")}
                onClick={() => toggleSort("portfolio")}
              />
              <SortableHeading
                label={t("portfolio.type")}
                mark={sortMark("asset_type")}
                onClick={() => toggleSort("asset_type")}
              />
              <SortableHeading
                label={t("portfolio.shares")}
                mark={sortMark("shares")}
                onClick={() => toggleSort("shares")}
                align="right"
              />
              <SortableHeading
                label={t("portfolio.price")}
                mark={sortMark("price")}
                onClick={() => toggleSort("price")}
                align="right"
              />
              <SortableHeading
                label={t("portfolio.total")}
                mark={sortMark("total")}
                onClick={() => toggleSort("total")}
                align="right"
              />
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  {t("common.loading")}
                </td>
              </tr>
            ) : null}
            {!isLoading && data.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  {t("portfolio.noTransactionsYet")}
                </td>
              </tr>
            ) : null}
            {sortedRows.map((position) => (
              <tr
                key={position.id}
                className="border-t border-border/50 transition-colors first:border-t-0 hover:bg-secondary/25"
              >
                <td className="px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    aria-label={`${t("portfolio.selectTransaction")} ${position.ticker}`}
                    checked={selected.has(position.id)}
                    onChange={(event) =>
                      setSelected((previous) =>
                        toggleSelection(previous, position.id, event.target.checked),
                      )
                    }
                    className="accent-primary"
                  />
                </td>
                <td className="px-3 py-3 text-xs tabular-nums">{position.transaction_date}</td>
                <td className="px-3 py-3 font-bold text-primary">{position.ticker}</td>
                <td className="px-3 py-3 text-xs">{portfolioName(position.portfolio_id)}</td>
                <td className="px-3 py-3 text-xs uppercase">{position.asset_type}</td>
                <td className="px-3 py-3 text-right tabular-nums">{Number(position.shares)}</td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {fmtCurrency(Number(position.price), position.currency)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {fmtCurrency(Number(position.shares) * Number(position.price), position.currency)}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right">
                  <RowActions
                    onEdit={() => editTransaction(position)}
                    onDelete={() =>
                      onDelete(position.id, position.ticker, position.transaction_date)
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </TerminalTable>
      </div>
    </>
  );
}

function toggleSelection(previous: Set<string>, id: string, checked: boolean) {
  const next = new Set(previous);
  if (checked) next.add(id);
  else next.delete(id);
  return next;
}

function SortableHeading({
  label,
  mark,
  onClick,
  align = "left",
}: {
  label: string;
  mark: string;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className="w-full select-none py-1 text-inherit focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {label}
        {mark}
      </button>
    </th>
  );
}

function MobileMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border/70 bg-card/70 p-6 text-center text-sm text-muted-foreground shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
      {children}
    </div>
  );
}

function MobileValue({
  label,
  value,
  align = "left",
}: {
  label: string;
  value: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="text-[9px] uppercase tracking-[0.04em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium leading-tight tabular-nums uppercase">{value}</div>
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <details className="relative inline-block text-left">
      <summary
        className="flex h-8 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-border/70 bg-background/50 text-sm transition-colors hover:border-primary/60 hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label={t("portfolio.rowActions")}
      >
        •••
      </summary>
      <div className="absolute right-0 z-20 mt-2 min-w-32 overflow-hidden rounded-lg border border-border/70 bg-popover p-1.5 shadow-xl">
        <button
          type="button"
          onClick={onEdit}
          className="block w-full rounded-md px-3 py-2 text-left text-xs uppercase transition-colors hover:bg-secondary/60 hover:text-primary"
        >
          {t("common.edit")}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="block w-full rounded-md px-3 py-2 text-left text-xs uppercase text-destructive transition-colors hover:bg-secondary/60"
        >
          {t("common.delete")}
        </button>
      </div>
    </details>
  );
}
