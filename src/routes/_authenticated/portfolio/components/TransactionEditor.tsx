import { useState, type ReactNode } from "react";
import type { TransactionInputType } from "@/lib/portfolio/transactions/api";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import { normalizeTicker, type TickerSuggestion } from "@/lib/portfolio/tickerCatalog";
import { useTranslation } from "react-i18next";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import type { PortfolioCashBalance } from "@/lib/portfolio/cash/api";
import { shouldOfferAvailableCash } from "@/lib/portfolio/cash/rules";

const ASSET_TYPES = ["stock", "etf", "crypto", "bond", "fund", "other"] as const;
const TRANSACTION_ACTIONS = ["buy", "sell", "dividend", "fee"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "HKD"];

type TransactionDraft = Omit<TransactionInputType, "shares" | "price" | "fee_amount"> & {
  shares: string;
  price: string;
  fee_amount: string;
};

const toDraft = (
  value: TransactionInputType & { id?: string; cash_used?: number },
): TransactionDraft & { id?: string } => ({
  ...value,
  action: value.action ?? "buy",
  shares: value.id == null && value.shares === 0 ? "" : String(value.shares),
  price: value.id == null && value.price === 0 ? "" : String(value.price),
  fee_amount: value.fee_amount ? String(value.fee_amount) : "",
});

function Field({
  label,
  children,
  colSpan = 1,
  required = false,
}: {
  label: string;
  children: ReactNode;
  colSpan?: 1 | 2;
  required?: boolean;
}) {
  return (
    <label className={`block ${colSpan === 2 ? "col-span-2" : ""}`}>
      <div className="mb-1 flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
        <span>{label}</span>
        {required ? (
          <span aria-hidden="true" className="text-sm font-bold leading-none text-destructive">
            *
          </span>
        ) : null}
      </div>
      {children}
    </label>
  );
}

export function TransactionEditor({
  value,
  portfolios,
  tickerSuggestions,
  cashBalances,
  onSave,
  onClose,
  busy,
}: {
  value: TransactionInputType & { id?: string; cash_used?: number };
  portfolios: { id: string; name: string }[];
  tickerSuggestions: TickerSuggestion[];
  cashBalances: PortfolioCashBalance[];
  onSave: (v: TransactionInputType) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState(() => toDraft(value));
  const [tickerMenuOpen, setTickerMenuOpen] = useState(false);
  const set = <K extends keyof TransactionDraft>(k: K, val: TransactionDraft[K]) => {
    setV((state) => ({ ...state, [k]: val }));
  };
  const tickerQuery = v.ticker.trim().toLowerCase();
  const tickerOptions = tickerSuggestions.filter((item) =>
    item.ticker.toLowerCase().includes(tickerQuery),
  );
  const tickerExactMatch = tickerOptions.some((item) => item.ticker.toLowerCase() === tickerQuery);
  const sharesValue = Number(v.shares);
  const priceValue = Number(v.price);
  const totalPreview = sharesValue * priceValue;
  const feeValue = Number(v.fee_amount || 0);
  const matchingCash = cashBalances.find(
    (row) =>
      row.portfolioId === (v.portfolio_id ?? null) &&
      row.currency.toUpperCase() === v.currency.toUpperCase(),
  );
  const returnsExistingCash =
    Boolean(value.id) &&
    value.action === "buy" &&
    value.portfolio_id === v.portfolio_id &&
    value.currency.toUpperCase() === v.currency.toUpperCase();
  const availableCash =
    Number(matchingCash?.availableAmount ?? 0) +
    (returnsExistingCash ? Number(value.cash_used ?? 0) : 0);
  const purchaseCost = totalPreview + (Number.isFinite(feeValue) ? feeValue : 0);
  const transactionTotal =
    v.action === "sell" ? totalPreview - (Number.isFinite(feeValue) ? feeValue : 0) : purchaseCost;
  const cashUsedPreview = v.use_available_cash ? Math.min(availableCash, purchaseCost) : 0;
  const hasValidTotalPreview =
    Number.isFinite(sharesValue) &&
    Number.isFinite(priceValue) &&
    v.shares !== "" &&
    v.price !== "";
  const applyTickerSuggestion = (item: TickerSuggestion) => {
    setV((state) => ({
      ...state,
      ticker: normalizeTicker(item.ticker),
      security_listing_id: item.security_listing_id,
      name: item.name ?? state.name ?? "",
      asset_type:
        item.asset_type && ASSET_TYPES.includes(item.asset_type as (typeof ASSET_TYPES)[number])
          ? (item.asset_type as TransactionInputType["asset_type"])
          : state.asset_type,
      market: item.market ?? state.market ?? null,
      currency: item.currency ?? state.currency,
    }));
    setTickerMenuOpen(false);
  };

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur md:items-center">
      <div className="analytics-panel w-full max-w-xl overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xl">
        <div className="flex justify-between border-b border-border/60 bg-secondary/25 px-5 py-4 text-xs uppercase tracking-[0.12em] text-primary">
          <span>
            &gt; {value.id ? t("portfolio.editTransaction") : t("portfolio.newTransaction")}
          </span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            x
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              ...v,
              shares: Number(v.shares),
              price: Number(v.price),
              fee_amount: Number(v.fee_amount || 0),
            });
          }}
          className="grid grid-cols-2 gap-4 p-5 [&_input]:rounded-lg [&_input]:border-border/70 [&_input]:bg-background/70 [&_input]:px-3 [&_input]:py-2.5 [&_input]:transition-colors [&_input]:focus:ring-1 [&_input]:focus:ring-primary/30 [&_select]:rounded-lg [&_select]:border-border/70 [&_select]:bg-background/70 [&_select]:px-3 [&_select]:py-2.5 [&_select]:transition-colors [&_select]:focus:ring-1 [&_select]:focus:ring-primary/30 [&_textarea]:rounded-lg [&_textarea]:border-border/70 [&_textarea]:bg-background/70 [&_textarea]:px-3 [&_textarea]:py-2.5 [&_textarea]:transition-colors [&_textarea]:focus:ring-1 [&_textarea]:focus:ring-primary/30"
        >
          <Field label={t("portfolio.date")} required>
            <input
              type="date"
              required
              value={v.transaction_date}
              onChange={(e) => set("transaction_date", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("portfolio.action")} required>
            <TerminalSelect
              value={v.action}
              onChange={(action) =>
                setV((state) => ({
                  ...state,
                  action: action as TransactionInputType["action"],
                  use_available_cash: action === "buy" ? state.use_available_cash : false,
                  fee_amount: action === "buy" || action === "sell" ? state.fee_amount : "",
                }))
              }
              ariaLabel={t("portfolio.action")}
              required
              options={TRANSACTION_ACTIONS.map((action) => ({
                value: action,
                label: transactionActionLabel(action, t),
              }))}
            />
          </Field>

          <Field label={t("portfolio.ticker")} required>
            <div className="relative">
              <input
                required
                value={v.ticker}
                onFocus={() => setTickerMenuOpen(true)}
                onBlur={() => setTimeout(() => setTickerMenuOpen(false), 120)}
                onChange={(e) =>
                  setV((state) => ({
                    ...state,
                    ticker: normalizeTicker(e.target.value),
                    security_listing_id: null,
                  }))
                }
                placeholder="AAPL"
                className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              {tickerMenuOpen && (tickerQuery.length > 0 || tickerOptions.length > 0) ? (
                <div className="terminal-scrollbar absolute z-10 mt-2 max-h-44 w-full overflow-auto rounded-lg border border-border/70 bg-popover p-1.5 shadow-xl">
                  {tickerOptions.map((item) => (
                    <button
                      key={item.ticker}
                      type="button"
                      onMouseDown={() => applyTickerSuggestion(item)}
                      className="block w-full rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] transition-colors hover:bg-secondary/55 hover:text-foreground"
                    >
                      {item.ticker}
                    </button>
                  ))}
                  {tickerQuery.length > 0 && !tickerExactMatch ? (
                    <button
                      type="button"
                      onMouseDown={() => {
                        set("ticker", normalizeTicker(v.ticker));
                        setTickerMenuOpen(false);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/10"
                    >
                      {t("car.editor.createValue", { value: normalizeTicker(v.ticker) })}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Field>

          <Field label={t("portfolio.assetType")} required>
            <TerminalSelect
              value={v.asset_type}
              onChange={(value) => set("asset_type", value as TransactionInputType["asset_type"])}
              ariaLabel={t("portfolio.assetType")}
              required
              options={ASSET_TYPES.map((type) => ({
                value: type,
                label: assetTypeLabel(type),
              }))}
            />
          </Field>

          <Field label={t("portfolio.currency")} required>
            <TerminalSelect
              value={v.currency}
              onChange={(value) => set("currency", value)}
              ariaLabel={t("portfolio.currency")}
              required
              options={CURRENCIES.map((currency) => ({
                value: currency,
                label: currency,
              }))}
            />
          </Field>

          <Field label={t("portfolio.name")} colSpan={2}>
            <input
              value={v.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("portfolio.portfolio")} colSpan={2}>
            <TerminalSelect
              value={v.portfolio_id ?? ""}
              onChange={(value) => set("portfolio_id", value || null)}
              ariaLabel={t("portfolio.portfolio")}
              placeholder={t("portfolio.selectPortfolio")}
              options={portfolios.map((portfolio) => ({
                value: portfolio.id,
                label: portfolio.name,
              }))}
            />
          </Field>

          <Field label={t("portfolio.shares")} required>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={v.shares}
              onChange={(e) => set("shares", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("portfolio.pricePerShare")} required>
            <input
              type="number"
              step="any"
              min="0"
              required
              value={v.price}
              onChange={(e) => set("price", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none"
            />
          </Field>

          {v.action === "buy" || v.action === "sell" ? (
            <Field label={t("portfolio.tradeFee")} colSpan={2}>
              <input
                type="number"
                step="any"
                min="0"
                value={v.fee_amount}
                onChange={(e) => set("fee_amount", e.target.value)}
                className="w-full border border-border bg-input px-2 py-1.5 text-sm tabular-nums focus:border-primary focus:outline-none"
              />
            </Field>
          ) : null}

          {shouldOfferAvailableCash(v.action, availableCash) ? (
            <label className="col-span-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={v.use_available_cash}
                  onChange={(e) => set("use_available_cash", e.target.checked)}
                  className="h-4 w-4"
                />
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.1em]">
                    {t("portfolio.useAvailableCash")}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t("portfolio.availableCashAmount", {
                      amount: fmtCurrency(availableCash, v.currency),
                    })}
                  </div>
                </div>
              </div>
              {v.use_available_cash && hasValidTotalPreview ? (
                <div className="mt-2 text-xs text-muted-foreground">
                  {t("portfolio.cashUsePreview", {
                    used: fmtCurrency(cashUsedPreview, v.currency),
                    remaining: fmtCurrency(
                      Math.max(0, availableCash - cashUsedPreview),
                      v.currency,
                    ),
                  })}
                </div>
              ) : null}
            </label>
          ) : null}

          <Field label={t("portfolio.notes")} colSpan={2}>
            <textarea
              rows={2}
              value={v.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </Field>

          <div className="col-span-2 border-t border-border/50 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="rounded-lg border border-border/70 bg-background/60 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t("portfolio.totalPreview")}
                </div>
                <div className="mt-1 text-sm font-bold text-foreground tabular-nums">
                  {hasValidTotalPreview ? fmtCurrency(transactionTotal, v.currency) : "-"}
                </div>
              </div>

              <div
                role="group"
                aria-label={t("portfolio.save")}
                className="inline-flex flex-wrap items-center gap-2"
              >
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-primary px-4 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_10px_28px_-16px_var(--color-primary)] transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? t("portfolio.saving") : t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3 py-2.5 text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function assetTypeLabel(type: (typeof ASSET_TYPES)[number]) {
  switch (type) {
    case "etf":
      return "ETF";
    case "stock":
      return "Stock";
    case "crypto":
      return "Crypto";
    case "bond":
      return "Bond";
    case "fund":
      return "Fund";
    case "other":
      return "Other";
  }
}

function transactionActionLabel(
  action: (typeof TRANSACTION_ACTIONS)[number],
  t: ReturnType<typeof useTranslation>["t"],
) {
  switch (action) {
    case "buy":
      return t("portfolio.actionBuy");
    case "sell":
      return t("portfolio.actionSell");
    case "dividend":
      return t("portfolio.actionDividend");
    case "fee":
      return t("portfolio.actionFee");
  }
}
