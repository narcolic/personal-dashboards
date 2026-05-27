import { useState, type ReactNode } from "react";
import type { TransactionInputType } from "@/lib/portfolio/transactions/api";
import { useTranslation } from "react-i18next";

const ASSET_TYPES = ["stock", "etf", "crypto", "bond", "fund", "other"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "HKD"];

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
  onSave,
  onClose,
  busy,
}: {
  value: TransactionInputType & { id?: string };
  portfolios: { id: string; name: string }[];
  onSave: (v: TransactionInputType) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [v, setV] = useState(value);
  const set = <K extends keyof TransactionInputType>(k: K, val: TransactionInputType[K]) => {
    setV((state) => ({ ...state, [k]: val }));
  };

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur md:items-center">
      <div className="w-full max-w-lg border border-border bg-card">
        <div className="flex justify-between border-b border-border bg-secondary/40 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-primary">
          <span>&gt; {value.id ? t("portfolio.editTransaction") : t("portfolio.newTransaction")}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            x
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(v);
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

          <Field label={t("portfolio.ticker")}>
            <input
              required
              value={v.ticker}
              onChange={(e) => set("ticker", e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("portfolio.type")}>
            <select
              value={v.asset_type}
              onChange={(e) =>
                set("asset_type", e.target.value as TransactionInputType["asset_type"])
              }
              className="w-full border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            >
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
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
              onChange={(e) => set("shares", Number(e.target.value))}
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
              onChange={(e) => set("price", Number(e.target.value))}
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

          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-border px-4 py-1.5 text-xs uppercase tracking-widest hover:border-primary"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="bg-primary px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-50"
            >
              {busy ? t("portfolio.saving") : t("portfolio.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
