import type { Dispatch, SetStateAction } from "react";

import { useTranslation } from "react-i18next";

import { OptionMenu } from "@/components/ui/OptionMenu";

import type {
  ActivityRow,
  ActivityTransaction,
  ActivitySortKey,
} from "@/lib/portfolio/activity/api";

import { TerminalTable } from "@/components/terminal/TerminalTable";

import { fmtCurrency } from "@/lib/portfolio/formatters";

type TransactionInputType = import("@/lib/portfolio/transactions/api").TransactionInputType;

type SortKey = ActivitySortKey;

type SortDirection = "asc" | "desc";

export function TransactionsTable({
  sortKey,
  sortDirection,
  onSort,

  data,

  isLoading,

  selected,

  setSelected,

  portfolioName,

  setEditing,

  onDelete,
}: {
  data: ActivityRow[];

  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;

  isLoading: boolean;

  selected: Set<string>;

  setSelected: Dispatch<SetStateAction<Set<string>>>;

  portfolioName: (id: string | null) => string;

  setEditing: Dispatch<
    SetStateAction<(TransactionInputType & { id?: string; cash_used?: number }) | null>
  >;

  onDelete: (id: string, ticker: string, transactionDate: string) => void;
}) {
  const { t } = useTranslation();

  const sortedRows = data;

  const eligibleRows = data.filter((row): row is ActivityTransaction => row.kind === "transaction");

  const toggleSort = onSort;

  const sortMark = (key: SortKey) => (sortKey !== key ? "" : sortDirection === "asc" ? " ↑" : " ↓");

  const editTransaction = (position: ActivityTransaction) => {
    setEditing({
      id: position.id,

      ticker: position.ticker,

      action: position.action ?? "buy",

      name: position.name ?? "",

      asset_type: position.asset_type as TransactionInputType["asset_type"],

      currency: position.currency,
      market: position.market,

      shares: Number(position.shares),

      price: Number(position.price),

      transaction_date: position.transaction_date,

      notes: position.notes ?? "",

      portfolio_id: position.portfolio_id ?? null,

      security_listing_id: position.security_listing_id,

      use_available_cash: Number(position.cash_used) > 0,

      fee_amount: Number(position.fee_amount),

      cash_used: Number(position.cash_used),
    });
  };

  return (
    <>
      <div className="space-y-2 md:hidden">
        {isLoading ? <MobileMessage>{t("common.loading")}</MobileMessage> : null}

        {!isLoading && sortedRows.length === 0 ? (
          <MobileMessage>{t("portfolio.noActivityYet")}</MobileMessage>
        ) : null}

        {sortedRows.map((position) => (
          <article
            key={`${position.kind}-${position.id}`}
            className="analytics-panel rounded-[10px] border border-border/70 bg-card/80 p-3 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2.5">
                {position.kind === "transaction" ? (
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
                ) : null}

                <div className="min-w-0">
                  <div className="font-bold text-primary">
                    {position.ticker ?? t("portfolio.actionWithdrawal")}
                  </div>

                  <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                    {position.transaction_date} · {portfolioName(position.portfolio_id)}
                  </div>
                </div>
              </div>

              {position.kind === "transaction" ? (
                <RowActions
                  onEdit={() => editTransaction(position)}
                  onDelete={() => onDelete(position.id, position.ticker, position.transaction_date)}
                />
              ) : null}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border/50 pt-2 text-[11px]">
              <div>
                <div className="text-[9px] uppercase text-muted-foreground">
                  {t("portfolio.action")}
                </div>
                <ActionBadge action={position.action} />
              </div>

              <MobileValue
                label={t("portfolio.shares")}
                value={position.shares == null ? "—" : String(Number(position.shares))}
                align="right"
              />

              <MobileValue
                label={t("portfolio.total")}
                value={fmtCurrency(
                  position.amount,

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
              <th className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  aria-label={t("portfolio.selectAllTransactions")}
                  checked={
                    eligibleRows.length > 0 && eligibleRows.every((row) => selected.has(row.id))
                  }
                  disabled={eligibleRows.length === 0}
                  onChange={(event) => {
                    if (event.target.checked)
                      setSelected(new Set(eligibleRows.map((row) => row.id)));
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
                label={t("portfolio.action")}
                mark={sortMark("action")}
                onClick={() => toggleSort("action")}
              />

              <SortableHeading
                label={t("portfolio.assetType")}
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
                <td colSpan={10} className="p-6 text-center text-muted-foreground">
                  {t("common.loading")}
                </td>
              </tr>
            ) : null}

            {!isLoading && data.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-6 text-center text-muted-foreground">
                  {t("portfolio.noActivityYet")}
                </td>
              </tr>
            ) : null}

            {sortedRows.map((position) => (
              <tr
                key={`${position.kind}-${position.id}`}
                className="border-t border-border/50 transition-colors first:border-t-0 hover:bg-secondary/25"
              >
                <td className="px-3 py-3 text-center">
                  {position.kind === "transaction" ? (
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
                  ) : null}
                </td>

                <td className="px-3 py-3 text-xs tabular-nums">{position.transaction_date}</td>

                <td className="px-3 py-3 font-bold text-primary">{position.ticker ?? "—"}</td>

                <td className="px-3 py-3 text-xs">{portfolioName(position.portfolio_id)}</td>

                <td className="px-3 py-3">
                  <ActionBadge action={position.action} />
                </td>

                <td className="px-3 py-3 text-xs uppercase">{position.asset_type ?? "—"}</td>

                <td className="px-3 py-3 text-right tabular-nums">
                  {position.shares == null ? "—" : Number(position.shares)}
                </td>

                <td className="px-3 py-3 text-right tabular-nums">
                  {position.price == null
                    ? "—"
                    : fmtCurrency(Number(position.price), position.currency)}
                </td>

                <td className="px-3 py-3 text-right tabular-nums">
                  {fmtCurrency(position.amount, position.currency)}
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-right">
                  {position.kind === "transaction" ? (
                    <RowActions
                      onEdit={() => editTransaction(position)}
                      onDelete={() =>
                        onDelete(position.id, position.ticker, position.transaction_date)
                      }
                    />
                  ) : null}
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
        className={`w-full select-none py-1 text-inherit ${align === "right" ? "text-right" : "text-left"} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`}
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

export function ActionBadge({ action }: { action: ActivityRow["action"] }) {
  const { t } = useTranslation();

  const labels = {
    buy: "actionBuy",
    sell: "actionSell",
    dividend: "actionDividend",
    fee: "actionFee",
    withdrawal: "actionWithdrawal",
  } as const;

  const tone =
    action === "buy"
      ? "bg-bull/10 text-bull border-bull/20"
      : action === "sell"
        ? "bg-primary/10 text-primary border-primary/20"
        : "bg-secondary/60 text-foreground border-border/70";

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-medium ${tone}`}
    >
      {t(`portfolio.${labels[action]}`)}
    </span>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();

  return (
    <OptionMenu
      label={t("portfolio.rowActions")}
      width={144}
      className="inline-flex h-8 w-9 items-center justify-center rounded-md border border-border/70 bg-background/50 text-sm hover:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      items={[
        { label: t("common.edit"), onSelect: onEdit },
        { label: t("common.delete"), onSelect: onDelete, destructive: true },
      ]}
    >
      •••
    </OptionMenu>
  );
}
