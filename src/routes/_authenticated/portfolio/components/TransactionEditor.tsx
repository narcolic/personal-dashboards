import { createPortal } from "react-dom";
import { useLayerPosition } from "@/components/ui/useLayerPosition";
import { useId, useRef, useState, type ReactNode } from "react";
import type { TransactionInputType } from "@/lib/portfolio/transactions/api";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import { normalizeTicker, type TickerSuggestion } from "@/lib/portfolio/tickerCatalog";
import { useTranslation } from "react-i18next";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import { useOptionLayer } from "@/components/ui/useOptionLayer";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import type { PortfolioCashBalance } from "@/lib/portfolio/cash/api";
import { shouldOfferAvailableCash } from "@/lib/portfolio/cash/rules";
import { validateTransactionDraft } from "@/lib/portfolio/transactions/editorRules";

const ASSET_TYPES = ["stock", "etf", "crypto", "bond", "fund", "other"] as const;
const ACTIONS = ["buy", "sell", "dividend", "fee"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "HKD"];
type Draft = Omit<TransactionInputType, "shares" | "price" | "fee_amount"> & {
  shares: string;
  price: string;
  fee_amount: string;
};
const controlClass =
  "h-11 w-full rounded-lg border border-border bg-background/60 px-3 text-sm text-foreground outline-none transition-colors duration-150 hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/15 aria-[invalid=true]:border-destructive disabled:opacity-60";

function Field({
  label,
  children,
  required,
  error,
  id,
  wide,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
  id: string;
  wide?: boolean;
}) {
  return (
    <div data-field={id} className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={id} className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-primary">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  number,
  children,
}: {
  title: string;
  number: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="flex items-center gap-2.5 text-base font-semibold">
        <span className="font-mono text-[10px] font-normal text-primary">{number}</span>
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
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
  error,
  defaultPortfolioId,
  portfoliosLoading = false,
  onCreatePortfolio,
}: {
  value: TransactionInputType & { id?: string; cash_used?: number };
  portfolios: { id: string; name: string }[];
  tickerSuggestions: TickerSuggestion[];
  cashBalances: PortfolioCashBalance[];
  onSave: (value: TransactionInputType) => void;
  onClose: () => void;
  busy: boolean;
  error?: string;
  defaultPortfolioId?: string | null;
  portfoliosLoading?: boolean;
  onCreatePortfolio?: (name: string) => Promise<string>;
}) {
  const { t } = useTranslation();
  const uid = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [v, setV] = useState<Draft>(() => ({
    ...value,
    shares: !value.id && value.shares === 0 ? "" : String(value.shares),
    price: !value.id && value.price === 0 ? "" : String(value.price),
    fee_amount: value.fee_amount ? String(value.fee_amount) : "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [additionalOpen, setAdditionalOpen] = useState(Boolean(value.notes || value.fee_amount));
  const [creating, setCreating] = useState(false);
  const [portfolioName, setPortfolioName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");
  const [tickerIndex, setTickerIndex] = useState(0);
  const submittingRef = useRef(false);
  const {
    open: tickerOpen,
    id: tickerId,
    triggerRef: tickerRef,
    layerRef: tickerMenuRef,
    show: showTickers,
    close: closeTickers,
  } = useOptionLayer<HTMLInputElement>();
  const tickerPosition = useLayerPosition(tickerRef, tickerOpen, 192);
  useDialogFocus(dialogRef, onClose, busy || createBusy);
  const portfolioId =
    v.portfolio_id ??
    (!value.id
      ? (defaultPortfolioId ?? (portfolios.length === 1 ? portfolios[0].id : null))
      : null) ??
    null;
  const set = <K extends keyof Draft>(key: K, val: Draft[K]) => {
    setV((state) => ({ ...state, [key]: val }));
    setErrors((state) => {
      const next = { ...state };
      delete next[key];
      return next;
    });
  };
  const fieldId = (key: string) => `${uid}-${key}`;
  const fieldProps = (key: string, label: string) => ({
    id: fieldId(key),
    label,
    error: errors[key] ? t(`portfolio.editor.${errors[key]}`) : undefined,
  });
  const inputProps = (key: string) => ({
    id: fieldId(key),
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `${fieldId(key)}-error` : undefined,
  });
  const selectProps = (key: string) => ({
    modern: true,
    id: fieldId(key),
    invalid: Boolean(errors[key]),
    describedBy: errors[key] ? `${fieldId(key)}-error` : undefined,
  });
  const tickerQuery = v.ticker.trim().toLowerCase();
  const tickerOptions = tickerSuggestions
    .filter(
      (item) =>
        item.ticker.toLowerCase().includes(tickerQuery) ||
        item.name?.toLowerCase().includes(tickerQuery),
    )
    .slice(0, 20);
  const exactMatch = tickerOptions.some((item) => item.ticker.toLowerCase() === tickerQuery);
  const tickerCount = tickerOptions.length + (tickerQuery && !exactMatch ? 1 : 0);
  const chooseTicker = (index: number) => {
    const item = tickerOptions[index];
    if (item)
      setV((state) => ({
        ...state,
        ticker: normalizeTicker(item.ticker),
        security_listing_id: item.security_listing_id,
        name: item.name ?? null,
        market: item.market ?? null,
        asset_type:
          item.asset_type && ASSET_TYPES.includes(item.asset_type as (typeof ASSET_TYPES)[number])
            ? (item.asset_type as TransactionInputType["asset_type"])
            : state.asset_type,
        currency: item.currency ?? state.currency,
      }));
    closeTickers();
    setErrors((state) => {
      const next = { ...state };
      delete next.ticker;
      return next;
    });
  };
  const shares = Number(v.shares);
  const price = Number(v.price);
  const subtotal = shares * price;
  const fee = v.action === "buy" || v.action === "sell" ? Number(v.fee_amount || 0) : 0;
  const total = v.action === "sell" ? subtotal - fee : subtotal + fee;
  const validPreview =
    v.shares !== "" &&
    v.price !== "" &&
    Number.isFinite(total) &&
    shares >= 0 &&
    price >= 0 &&
    fee >= 0;
  const matchingCash = cashBalances.find(
    (row) =>
      row.portfolioId === portfolioId && row.currency.toUpperCase() === v.currency.toUpperCase(),
  );
  const returnsExistingCash =
    Boolean(value.id) &&
    value.action === "buy" &&
    value.portfolio_id === portfolioId &&
    value.currency.toUpperCase() === v.currency.toUpperCase();
  const availableCash =
    Number(matchingCash?.availableAmount ?? 0) +
    (returnsExistingCash ? Number(value.cash_used ?? 0) : 0);
  const cashUsed = v.use_available_cash ? Math.min(availableCash, subtotal + fee) : 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-3 backdrop-blur-sm sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-description`}
        className="transaction-dialog flex max-h-[calc(100dvh-24px)] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-border bg-card font-analytics text-foreground shadow-[0_24px_100px_rgba(0,0,0,0.45)] sm:max-h-[calc(100dvh-48px)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 px-5 py-5 sm:px-7">
          <div>
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-primary">
              {t("header.activity")}
            </div>
            <h2 id={`${uid}-title`} className="text-xl font-semibold tracking-tight">
              {t(value.id ? "portfolio.editor.editTitle" : "portfolio.editor.addTitle")}
            </h2>
            <p id={`${uid}-description`} className="mt-1.5 text-sm text-muted-foreground">
              {t("portfolio.editor.subtitle")}
            </p>
          </div>
          <button
            type="button"
            data-autofocus
            disabled={busy || createBusy}
            onClick={onClose}
            aria-label={t("portfolio.editor.close")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            ×
          </button>
        </header>
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || createBusy || submittingRef.current) return;
            const next = validateTransactionDraft({ ...v, portfolio_id: portfolioId });
            setErrors(next);
            const first = [
              "portfolio_id",
              "transaction_date",
              "ticker",
              "shares",
              "price",
              "fee_amount",
              "notes",
            ].find((key) => next[key]);
            if (first) {
              if (first === "fee_amount" || first === "notes") setAdditionalOpen(true);
              requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
              return;
            }
            submittingRef.current = true;
            try {
              onSave({ ...v, portfolio_id: portfolioId, shares, price, fee_amount: fee });
            } finally {
              queueMicrotask(() => {
                submittingRef.current = false;
              });
            }
          }}
        >
          <div className="terminal-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-7">
              <Section title={t("portfolio.editor.transaction")} number="01">
                <Field {...fieldProps("action", t("portfolio.action"))} required>
                  <TerminalSelect
                    {...selectProps("action")}
                    value={v.action}
                    required
                    disabled={busy}
                    ariaLabel={t("portfolio.action")}
                    options={ACTIONS.map((action) => ({
                      value: action,
                      label: t(`portfolio.action${action[0].toUpperCase()}${action.slice(1)}`),
                    }))}
                    onChange={(action) =>
                      setV((state) => ({
                        ...state,
                        action: action as TransactionInputType["action"],
                        use_available_cash: action === "buy" ? state.use_available_cash : false,
                        fee_amount: action === "buy" || action === "sell" ? state.fee_amount : "",
                      }))
                    }
                  />
                </Field>
                <Field {...fieldProps("portfolio_id", t("portfolio.portfolio"))} required>
                  <TerminalSelect
                    {...selectProps("portfolio_id")}
                    value={portfolioId ?? ""}
                    required
                    disabled={busy || portfoliosLoading}
                    ariaLabel={t("portfolio.portfolio")}
                    placeholder={t("portfolio.selectPortfolio")}
                    options={portfolios.map((p) => ({ value: p.id, label: p.name }))}
                    onChange={(id) => set("portfolio_id", id)}
                  />
                  {!portfoliosLoading && portfolios.length === 0 && onCreatePortfolio ? (
                    <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3">
                      {!creating ? (
                        <>
                          <p className="text-xs text-muted-foreground">
                            {t("portfolio.editor.noPortfolios")}
                          </p>
                          <button
                            type="button"
                            onClick={() => setCreating(true)}
                            className="mt-2 text-sm font-semibold text-primary"
                          >
                            + {t("portfolio.editor.createPortfolio")}
                          </button>
                        </>
                      ) : (
                        <>
                          <label htmlFor={`${uid}-portfolio-name`} className="mb-2 block text-xs">
                            {t("portfolio.editor.portfolioName")}
                          </label>
                          <input
                            id={`${uid}-portfolio-name`}
                            className={controlClass}
                            value={portfolioName}
                            maxLength={80}
                            disabled={createBusy}
                            onChange={(event) => setPortfolioName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                dialogRef.current
                                  ?.querySelector<HTMLButtonElement>("[data-create-portfolio]")
                                  ?.click();
                              }
                            }}
                          />
                          <button
                            type="button"
                            data-create-portfolio
                            disabled={createBusy || !portfolioName.trim()}
                            className="mt-2 text-sm font-semibold text-primary disabled:opacity-50"
                            onClick={async () => {
                              setCreateBusy(true);
                              setCreateError("");
                              try {
                                const id = await onCreatePortfolio(portfolioName.trim());
                                set("portfolio_id", id);
                                setCreating(false);
                              } catch (e) {
                                setCreateError(
                                  e instanceof Error ? e.message : t("portfolio.editor.saveFailed"),
                                );
                              } finally {
                                setCreateBusy(false);
                              }
                            }}
                          >
                            {t(
                              createBusy ? "portfolio.saving" : "portfolio.editor.createPortfolio",
                            )}
                          </button>
                          {createError ? (
                            <p role="alert" className="mt-2 text-xs text-destructive">
                              {createError}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  ) : null}
                </Field>
                <Field {...fieldProps("transaction_date", t("portfolio.date"))} required wide>
                  <input
                    {...inputProps("transaction_date")}
                    type="date"
                    required
                    disabled={busy}
                    value={v.transaction_date}
                    onChange={(event) => set("transaction_date", event.target.value)}
                    className={controlClass}
                  />
                </Field>
              </Section>
              <div className="border-t border-border/60 pt-5 md:border-l md:border-t-0 md:pl-7 md:pt-0">
                <Section title={t("portfolio.editor.asset")} number="02">
                  <Field {...fieldProps("ticker", t("portfolio.ticker"))} required wide>
                    <div className="relative">
                      <input
                        {...inputProps("ticker")}
                        ref={tickerRef}
                        required
                        disabled={busy}
                        value={v.ticker}
                        placeholder="AAPL"
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={tickerOpen}
                        aria-controls={tickerOpen && tickerCount > 0 ? tickerId : undefined}
                        aria-activedescendant={
                          tickerOpen && tickerCount > 0 ? `${tickerId}-${tickerIndex}` : undefined
                        }
                        onFocus={() => {
                          setTickerIndex(0);
                          showTickers();
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                            event.preventDefault();
                            showTickers();
                            setTickerIndex((index) =>
                              tickerCount
                                ? (index + (event.key === "ArrowDown" ? 1 : -1) + tickerCount) %
                                  tickerCount
                                : 0,
                            );
                          }
                          if (event.key === "Enter" && tickerOpen && tickerCount) {
                            event.preventDefault();
                            chooseTicker(tickerIndex);
                          }
                          if (event.key === "Tab") closeTickers();
                        }}
                        onChange={(event) => {
                          setV((state) => ({
                            ...state,
                            ticker: normalizeTicker(event.target.value),
                            security_listing_id: null,
                            name: null,
                            market: null,
                          }));
                          setTickerIndex(0);
                          showTickers();
                        }}
                        className={`${controlClass} font-mono`}
                      />
                      {tickerOpen && tickerCount > 0 && tickerPosition
                        ? createPortal(
                            <div
                              ref={tickerMenuRef}
                              id={tickerId}
                              role="listbox"
                              aria-label={t("portfolio.ticker")}
                              style={tickerPosition}
                              className="option-layer terminal-scrollbar fixed z-[100] w-full overflow-auto rounded-xl border border-border bg-popover p-1.5 font-analytics shadow-xl"
                            >
                              {tickerOptions.map((item, index) => (
                                <button
                                  id={`${tickerId}-${index}`}
                                  key={item.ticker}
                                  type="button"
                                  role="option"
                                  aria-selected={index === tickerIndex}
                                  tabIndex={-1}
                                  onPointerDown={(event) => event.preventDefault()}
                                  onClick={() => chooseTicker(index)}
                                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${index === tickerIndex ? "bg-secondary/60" : "hover:bg-secondary/40"}`}
                                >
                                  <span className="font-mono font-semibold text-primary">
                                    {item.ticker}
                                  </span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {item.name}
                                  </span>
                                </button>
                              ))}
                              {tickerQuery && !exactMatch ? (
                                <button
                                  id={`${tickerId}-${tickerOptions.length}`}
                                  role="option"
                                  aria-selected={tickerIndex === tickerOptions.length}
                                  tabIndex={-1}
                                  type="button"
                                  onPointerDown={(event) => event.preventDefault()}
                                  onClick={() => chooseTicker(tickerOptions.length)}
                                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-primary hover:bg-primary/10"
                                >
                                  {t("portfolio.editor.useTicker", { ticker: v.ticker })}
                                </button>
                              ) : null}
                            </div>,
                            document.body,
                          )
                        : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {v.name || t("portfolio.editor.tickerHint")}
                    </p>
                  </Field>
                  <Field {...fieldProps("asset_type", t("portfolio.editor.assetType"))} required>
                    <TerminalSelect
                      {...selectProps("asset_type")}
                      value={v.asset_type}
                      required
                      disabled={busy}
                      ariaLabel={t("portfolio.editor.assetType")}
                      options={ASSET_TYPES.map((type) => ({
                        value: type,
                        label: t(`portfolio.editor.types.${type}`),
                      }))}
                      onChange={(type) =>
                        set("asset_type", type as TransactionInputType["asset_type"])
                      }
                    />
                  </Field>
                  <Field {...fieldProps("currency", t("portfolio.currency"))} required>
                    <TerminalSelect
                      {...selectProps("currency")}
                      value={v.currency}
                      required
                      disabled={busy}
                      ariaLabel={t("portfolio.currency")}
                      options={Array.from(new Set([...CURRENCIES, v.currency])).map((currency) => ({
                        value: currency,
                        label: currency,
                      }))}
                      onChange={(currency) => set("currency", currency)}
                    />
                  </Field>
                </Section>
              </div>
            </div>
            <div className="border-t border-border/60" />
            <Section title={t("portfolio.editor.amounts")} number="03">
              <Field {...fieldProps("shares", t("portfolio.shares"))} required>
                <input
                  {...inputProps("shares")}
                  type="number"
                  step="any"
                  min="0"
                  max="1000000000"
                  required
                  disabled={busy}
                  value={v.shares}
                  placeholder="0"
                  onChange={(event) => set("shares", event.target.value)}
                  className={`${controlClass} tabular-nums`}
                />
              </Field>
              <Field
                {...fieldProps(
                  "price",
                  t("portfolio.editor.pricePerShare", { currency: v.currency }),
                )}
                required
              >
                <input
                  {...inputProps("price")}
                  type="number"
                  step="any"
                  min="0"
                  max="1000000000"
                  required
                  disabled={busy}
                  value={v.price}
                  placeholder="0.00"
                  onChange={(event) => set("price", event.target.value)}
                  className={`${controlClass} tabular-nums`}
                />
              </Field>
              {shouldOfferAvailableCash(v.action, availableCash) ? (
                <label className="flex gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-primary"
                    disabled={busy}
                    checked={v.use_available_cash}
                    onChange={(event) => set("use_available_cash", event.target.checked)}
                  />
                  <div>
                    <span className="text-sm font-medium">{t("portfolio.useAvailableCash")}</span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("portfolio.availableCashAmount", {
                        amount: fmtCurrency(availableCash, v.currency),
                      })}
                    </p>
                    {v.use_available_cash && validPreview ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t("portfolio.cashUsePreview", {
                          used: fmtCurrency(cashUsed, v.currency),
                          remaining: fmtCurrency(Math.max(0, availableCash - cashUsed), v.currency),
                        })}
                      </p>
                    ) : null}
                  </div>
                </label>
              ) : null}
            </Section>
            <section className="rounded-xl border border-border/70 bg-background/20">
              <button
                type="button"
                aria-expanded={additionalOpen}
                aria-controls={`${uid}-additional`}
                onClick={() => setAdditionalOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left text-sm font-medium hover:bg-secondary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span>
                  {t("portfolio.editor.additional")}{" "}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {t("portfolio.editor.optional")}
                  </span>
                </span>
                <span aria-hidden="true" className="text-primary">
                  {additionalOpen ? "−" : "+"}
                </span>
              </button>
              <div
                id={`${uid}-additional`}
                hidden={!additionalOpen}
                className="space-y-4 border-t border-border/50 p-4"
              >
                {v.action === "buy" || v.action === "sell" ? (
                  <Field
                    {...fieldProps(
                      "fee_amount",
                      t("portfolio.editor.tradeFee", { currency: v.currency }),
                    )}
                  >
                    <input
                      {...inputProps("fee_amount")}
                      type="number"
                      step="any"
                      min="0"
                      max="1000000000"
                      disabled={busy}
                      value={v.fee_amount}
                      placeholder="0.00"
                      onChange={(event) => set("fee_amount", event.target.value)}
                      className={`${controlClass} tabular-nums`}
                    />
                  </Field>
                ) : null}
                <Field {...fieldProps("notes", t("portfolio.notes"))}>
                  <textarea
                    {...inputProps("notes")}
                    rows={2}
                    disabled={busy}
                    value={v.notes ?? ""}
                    onChange={(event) => set("notes", event.target.value)}
                    placeholder={t("portfolio.editor.notesHint")}
                    className={`${controlClass} h-auto resize-y py-3`}
                  />
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">
                    {(v.notes ?? "").length}/500
                  </p>
                </Field>
              </div>
            </section>
          </div>
          <footer className="shrink-0 border-t border-border bg-secondary/15 px-5 py-4 sm:px-7">
            {error ? (
              <p
                role="alert"
                className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  {t("portfolio.editor.total")}
                </div>
                <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                  {validPreview ? fmtCurrency(total, v.currency) : "—"}
                </div>
                {validPreview ? (
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {t("portfolio.editor.subtotal")}: {fmtCurrency(subtotal, v.currency)}
                    {fee
                      ? ` · ${t("portfolio.tradeFee")}: ${v.action === "sell" ? "−" : "+"}${fmtCurrency(fee, v.currency)}`
                      : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy || createBusy}
                  onClick={onClose}
                  className="rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={busy || createBusy || portfoliosLoading || portfolios.length === 0}
                  className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_6px_18px_-8px_var(--color-primary)] transition-all duration-150 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t(busy ? "portfolio.saving" : "portfolio.editor.save")}
                </button>
              </div>
            </div>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
}
