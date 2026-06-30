import { useState, type ReactNode } from "react";
import type { TransactionInputType } from "@/lib/portfolio/transactions/api";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import { normalizeTicker, type TickerSuggestion } from "@/lib/portfolio/tickerCatalog";
import { useTranslation } from "react-i18next";

const ASSET_TYPES = ["stock", "etf", "crypto", "bond", "fund", "other"] as const;
const TRANSACTION_ACTIONS = ["buy", "sell", "dividend", "fee"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "HKD"];

type TransactionDraft = Omit<TransactionInputType, "shares" | "price"> & {
  shares: string;
  price: string;
};

const toDraft = (
  value: TransactionInputType & { id?: string },
): TransactionDraft & { id?: string } => ({
  ...value,
  action: value.action ?? "buy",
  shares: value.id == null && value.shares === 0 ? "" : String(value.shares),
  price: value.id == null && value.price === 0 ? "" : String(value.price),
});

function Field({
  label,
  children,
  colSpan = 1,
}: {
  label: string;
  children: ReactNode;
  colSpan?: 1 | 2;
}) {
  return (
    <label className={`block ${colSpan === 2 ? "col-span-2" : ""}`}>
      <div className="mb-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </div>
      {children}
    </label>
  );
}

export function TransactionEditor({
  value,
  portfolios,
  tickerSuggestions,
  onSave,
  onClose,
  busy,
}: {
  value: TransactionInputType & { id?: string };
  portfolios: { id: string; name: string }[];
  tickerSuggestions: TickerSuggestion[];
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
  const hasValidTotalPreview =
    Number.isFinite(sharesValue) &&
    Number.isFinite(priceValue) &&
    v.shares !== "" &&
    v.price !== "";
  const applyTickerSuggestion = (item: TickerSuggestion) => {
    setV((state) => ({
      ...state,
      ticker: normalizeTicker(item.ticker),
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
      <div className="w-full max-w-xl border border-border bg-card">
        <div className="flex justify-between border-b border-border bg-secondary/40 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-primary">
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
            });
          }}
          className="grid grid-cols-2 gap-3 p-4"
        >
          <Field label={t("portfolio.date")}>
            <input
              type="date"
              required
              value={v.transaction_date}
              onChange={(e) => set("transaction_date", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("portfolio.action")}>
            <select
              value={v.action}
              onChange={(e) => set("action", e.target.value as TransactionInputType["action"])}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              {TRANSACTION_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {transactionActionLabel(action, t)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("portfolio.ticker")}>
            <div className="relative">
              <input
                required
                value={v.ticker}
                onFocus={() => setTickerMenuOpen(true)}
                onBlur={() => setTimeout(() => setTickerMenuOpen(false), 120)}
                onChange={(e) => set("ticker", normalizeTicker(e.target.value))}
                placeholder="AAPL"
                className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
              />
              {tickerMenuOpen && (tickerQuery.length > 0 || tickerOptions.length > 0) ? (
                <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto border border-border bg-card">
                  {tickerOptions.map((item) => (
                    <button
                      key={item.ticker}
                      type="button"
                      onMouseDown={() => applyTickerSuggestion(item)}
                      className="block w-full px-2 py-1.5 text-left hover:bg-primary/10 hover:text-primary"
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
                      className="block w-full px-2 py-1.5 text-left hover:bg-primary/10 hover:text-primary"
                    >
                      {t("car.editor.createValue", { value: normalizeTicker(v.ticker) })}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Field>

          <Field label={t("portfolio.assetType")}>
            <select
              value={v.asset_type}
              onChange={(e) =>
                set("asset_type", e.target.value as TransactionInputType["asset_type"])
              }
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {assetTypeLabel(type)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("portfolio.currency")}>
            <select
              value={v.currency}
              onChange={(e) => set("currency", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              {CURRENCIES.map((ccy) => (
                <option key={ccy}>{ccy}</option>
              ))}
            </select>
          </Field>

          <Field label={t("portfolio.name")} colSpan={2}>
            <input
              value={v.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("portfolio.portfolio")} colSpan={2}>
            <select
              required
              value={v.portfolio_id ?? ""}
              onChange={(e) => set("portfolio_id", e.target.value || null)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              <option value="" disabled>
                {t("portfolio.selectPortfolio")}
              </option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("portfolio.shares")}>
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

          <Field label={t("portfolio.pricePerShare")}>
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

          <Field label={t("portfolio.notes")} colSpan={2}>
            <textarea
              rows={2}
              value={v.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </Field>

          <div className="col-span-2 border-t border-border/40 pt-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="border border-border bg-background px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {t("portfolio.totalPreview")}
                </div>
                <div className="mt-1 text-sm font-bold text-foreground tabular-nums">
                  {hasValidTotalPreview ? fmtCurrency(totalPreview, v.currency) : "-"}
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
                  className="bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90 disabled:opacity-60"
                >
                  {busy ? t("portfolio.saving") : t("common.save")}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
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
