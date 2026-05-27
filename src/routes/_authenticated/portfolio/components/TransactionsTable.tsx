import { TerminalTable } from "@/components/terminal/TerminalTable";
import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type TransactionInputType = import("@/lib/portfolio/transactions/api").TransactionInputType;

type TransactionTableRow = {
  id: string;
  ticker: string;
  name: string | null;
  asset_type: string;
  currency: string;
  shares: number;
  price: number;
  transaction_date: string;
  notes: string | null;
  portfolio_id: string | null;
};

type SortKey =
  | "transaction_date"
  | "ticker"
  | "portfolio"
  | "asset_type"
  | "shares"
  | "price"
  | "currency";
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
    rows.sort((a, b) => {
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
          case "currency":
            return row.currency;
        }
      };

      const av = getValue(a);
      const bv = getValue(b);
      const dir = sortDirection === "asc" ? 1 : -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return rows;
  }, [data, portfolioName, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const sortMark = (key: SortKey) => (sortKey !== key ? "" : sortDirection === "asc" ? " ↑" : " ↓");

  return (
    <TerminalTable variant="panel">
      <thead className="bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground">
        <tr>
          <th className="px-2 py-2 text-center">
            <input
              type="checkbox"
              checked={data.length > 0 && selected.size === data.length}
              onChange={(e) => {
                if (e.target.checked) setSelected(new Set(sortedRows.map((p) => p.id)));
                else setSelected(new Set());
              }}
              className="accent-primary"
            />
          </th>
          <th className="px-3 py-2 text-left cursor-pointer select-none" onClick={() => toggleSort("transaction_date")}>
            {t("portfolio.date")}
            {sortMark("transaction_date")}
          </th>
          <th className="px-3 py-2 text-left cursor-pointer select-none" onClick={() => toggleSort("ticker")}>
            {t("portfolio.ticker")}
            {sortMark("ticker")}
          </th>
          <th className="px-3 py-2 text-left cursor-pointer select-none" onClick={() => toggleSort("portfolio")}>
            {t("portfolio.portfolio")}
            {sortMark("portfolio")}
          </th>
          <th className="px-3 py-2 text-left cursor-pointer select-none" onClick={() => toggleSort("asset_type")}>
            {t("portfolio.type")}
            {sortMark("asset_type")}
          </th>
          <th className="px-3 py-2 text-right cursor-pointer select-none" onClick={() => toggleSort("shares")}>
            {t("portfolio.shares")}
            {sortMark("shares")}
          </th>
          <th className="px-3 py-2 text-right cursor-pointer select-none" onClick={() => toggleSort("price")}>
            {t("portfolio.price")}
            {sortMark("price")}
          </th>
          <th className="px-3 py-2 text-right cursor-pointer select-none" onClick={() => toggleSort("currency")}>
            {t("portfolio.ccy")}
            {sortMark("currency")}
          </th>
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        {isLoading && (
          <tr>
            <td colSpan={9} className="p-6 text-center text-muted-foreground">
              {t("common.loading")}
            </td>
          </tr>
        )}
        {!isLoading && data.length === 0 && (
          <tr>
            <td colSpan={9} className="p-6 text-center text-muted-foreground">
              {t("portfolio.noTransactionsYet")}
            </td>
          </tr>
        )}
        {sortedRows.map((position) => (
          <tr key={position.id} className="border-t border-border/60 hover:bg-secondary/30">
            <td className="px-2 py-2 text-center">
              <input
                type="checkbox"
                checked={selected.has(position.id)}
                onChange={(e) => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(position.id);
                    else next.delete(position.id);
                    return next;
                  });
                }}
                className="accent-primary"
              />
            </td>
            <td className="px-3 py-2 text-[11px] tabular-nums">{position.transaction_date}</td>
            <td className="px-3 py-2 font-bold text-primary">{position.ticker}</td>
            <td className="px-3 py-2 text-[11px]">{portfolioName(position.portfolio_id)}</td>
            <td className="px-3 py-2 text-[11px] uppercase">{position.asset_type}</td>
            <td className="px-3 py-2 text-right tabular-nums">{Number(position.shares)}</td>
            <td className="px-3 py-2 text-right tabular-nums">{Number(position.price).toFixed(2)}</td>
            <td className="px-3 py-2 text-[11px]">{position.currency}</td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
              <button
                onClick={() =>
                  setEditing({
                    id: position.id,
                    ticker: position.ticker,
                    name: position.name ?? "",
                    asset_type: position.asset_type as TransactionInputType["asset_type"],
                    currency: position.currency,
                    shares: Number(position.shares),
                    price: Number(position.price),
                    transaction_date: position.transaction_date,
                    notes: position.notes ?? "",
                    portfolio_id: position.portfolio_id ?? null,
                  })
                }
                className="mr-3 text-[11px] uppercase text-primary hover:underline"
              >
                {t("common.edit")}
              </button>
              <button
                onClick={() => onDelete(position.id, position.ticker, position.transaction_date)}
                className="text-[11px] uppercase text-bear hover:underline"
              >
                {t("common.deleteShort")}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </TerminalTable>
  );
}
