import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { mapCsvRows, parseCSV } from "@/lib/csv";
import { normalizeTicker, type TickerSuggestion } from "@/lib/portfolio/tickerCatalog";
import {
  createPortfolio,
  deletePortfolio,
  type PortfolioInputType,
} from "@/lib/portfolio/portfolios/api";
import { invalidatePortfolioData } from "@/lib/portfolio/queries";
import {
  createTransaction,
  deleteTransaction,
  deleteTransactions,
  importTransactions,
  type ImportedTransactionInput,
  type TransactionInputType,
  updateTransaction,
} from "@/lib/portfolio/transactions/api";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import { TransactionsTable } from "@/routes/_authenticated/portfolio/components/TransactionsTable";
import { TransactionEditor } from "@/routes/_authenticated/portfolio/components/TransactionEditor";
import {
  type PortfolioRecord,
  usePortfolioData,
} from "@/routes/_authenticated/portfolio/hooks/usePortfolioData";
import { useTickerCatalog } from "@/routes/_authenticated/portfolio/hooks/useTickerCatalog";

const ASSET_TYPES = ["stock", "etf", "crypto", "bond", "fund", "other"] as const;
const TRANSACTIONS_PAGE_SIZE = 25;
const ALL_FILTER = "__all__";
const today = () => new Date().toISOString().slice(0, 10);

const empty = (): TransactionInputType => ({
  ticker: "",
  action: "buy",
  name: "",
  asset_type: "stock",
  market: null,
  currency: "USD",
  shares: 0,
  price: 0,
  transaction_date: today(),
  notes: "",
  portfolio_id: null,
});

type TransactionTableRow = {
  id: string;
  ticker: string;
  action?: TransactionInputType["action"];
  name: string | null;
  asset_type: string;
  market: string | null;
  currency: string;
  shares: number;
  price: number;
  transaction_date: string;
  notes: string | null;
  portfolio_id: string | null;
  security_listing_id: string | null;
};

type DeleteDialogState = {
  kind: "transaction" | "bulk-transactions" | "portfolio";
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
};

export function ActivityPage({
  openAddTransaction = false,
  onAddHandled,
}: {
  openAddTransaction?: boolean;
  onAddHandled?: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<(TransactionInputType & { id?: string }) | null>(() =>
    openAddTransaction ? empty() : null,
  );
  const [showPortfolios, setShowPortfolios] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [page, setPage] = useState(1);
  const [tickerFilter, setTickerFilter] = useState("");
  const [portfolioFilter, setPortfolioFilter] = useState(ALL_FILTER);
  const [typeFilter, setTypeFilter] = useState(ALL_FILTER);
  const [currencyFilter, setCurrencyFilter] = useState(ALL_FILTER);
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showImportHelp, setShowImportHelp] = useState(false);

  const { txQ, transactions, transactionCount, portfolios } = usePortfolioData({
    transactionFilters: {
      ticker: tickerFilter.trim() || undefined,
      portfolioId: portfolioFilter === ALL_FILTER ? undefined : portfolioFilter,
      assetType: typeFilter === ALL_FILTER ? undefined : typeFilter,
      currency: currencyFilter === ALL_FILTER ? undefined : currencyFilter,
      dateFrom: dateFromFilter || undefined,
      dateTo: dateToFilter || undefined,
    },
    transactionPagination: { page, pageSize: TRANSACTIONS_PAGE_SIZE },
  });
  const { tickerCatalog } = useTickerCatalog();
  const data = transactions.map((row) => {
    if (!row.security) {
      throw new Error(`Canonical security metadata is missing for transaction ${row.id}.`);
    }
    return {
      ...row,
      ticker: row.security.symbol,
      name: row.security.name,
      asset_type: row.security.securityType,
      market: row.security.exchangeName ?? row.security.exchangeMic,
    };
  }) as TransactionTableRow[];
  const isLoading = txQ.isLoading;
  const pageCount = Math.max(1, Math.ceil(transactionCount / TRANSACTIONS_PAGE_SIZE));
  const pageStart = transactionCount === 0 ? 0 : (page - 1) * TRANSACTIONS_PAGE_SIZE + 1;
  const pageEnd = Math.min(page * TRANSACTIONS_PAGE_SIZE, transactionCount);
  const tickerSuggestions = useMemo(() => {
    const map = new Map<string, TickerSuggestion>();

    for (const row of data) {
      const ticker = normalizeTicker(row.ticker);
      if (!ticker || map.has(ticker)) continue;
      map.set(ticker, {
        ticker,
        name: row.name ?? null,
        asset_type: row.asset_type ?? null,
        market: row.market ?? null,
        currency: row.currency ?? null,
        security_listing_id: row.security_listing_id ?? null,
      });
    }

    for (const row of tickerCatalog) {
      if (!row.security) {
        throw new Error(`Canonical security metadata is missing for catalog row ${row.id}.`);
      }
      const ticker = normalizeTicker(row.security.symbol);
      if (!ticker) continue;
      map.set(ticker, {
        ticker,
        name: row.security.name,
        asset_type: row.security.securityType,
        market: row.security.exchangeName ?? row.security.exchangeMic,
        currency: row.security.tradingCurrency,
        security_listing_id: row.security.listingId,
      });
    }

    return Array.from(map.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [data, tickerCatalog]);
  const currencyOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...data.map((row) => (row.currency || "").toUpperCase()),
            ...tickerCatalog.map((row) => (row.currency || "").toUpperCase()),
          ].filter(Boolean),
        ),
      ).sort(),
    [data, tickerCatalog],
  );

  const invalidate = () => {
    invalidatePortfolioData(qc);
  };

  const portfolioName = useMemo(() => {
    const map = new Map(portfolios.map((p) => [p.id, p.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "-") : t("portfolio.unassigned"));
  }, [portfolios, t]);

  const createM = useMutation({
    mutationFn: async (value: TransactionInputType) => {
      await createTransaction(value);
    },
    onSuccess: () => {
      invalidate();
      setPage(1);
      setEditing(null);
      if (openAddTransaction) onAddHandled?.();
      toast.success(t("portfolio.transactionAdded"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: async (value: TransactionInputType & { id: string }) => {
      const { id, ...rest } = value;
      await updateTransaction(id, rest);
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success(t("portfolio.updated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      await deleteTransaction(id);
    },
    onSuccess: () => {
      if (data.length === 1 && page > 1) {
        setPage((current) => current - 1);
      }
      invalidate();
      setDeleteDialog(null);
      toast.success(t("portfolio.removed"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteM = useMutation({
    mutationFn: async (ids: string[]) => {
      return deleteTransactions(ids);
    },
    onSuccess: (result) => {
      if (result.deleted >= data.length && page > 1) {
        setPage((current) => current - 1);
      }
      invalidate();
      setDeleteDialog(null);
      setSelected(new Set());
      toast.success(t("portfolio.deletedTransactions", { count: result.deleted }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createP = useMutation({
    mutationFn: async (value: PortfolioInputType) => {
      await createPortfolio(value);
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("portfolio.portfolioAdded"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delP = useMutation({
    mutationFn: async (id: string) => {
      await deletePortfolio(id);
    },
    onSuccess: () => {
      invalidate();
      setDeleteDialog(null);
      toast.success(t("portfolio.portfolioRemoved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importM = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const parsed = parseCSV(text);
      const { rows, errors } = mapCsvRows(parsed);

      if (errors.length > 0) {
        errors.slice(0, 3).forEach((error) => toast.error(error));
      }
      if (rows.length === 0) {
        throw new Error(t("portfolio.noValidRows"));
      }

      const payload: ImportedTransactionInput[] = rows.map((row) => ({
        ticker: row.ticker,
        name: row.name ?? null,
        asset_type: (ASSET_TYPES as readonly string[]).includes(row.asset_type ?? "")
          ? (row.asset_type as TransactionInputType["asset_type"])
          : "stock",
        market: null,
        currency: row.currency ?? "USD",
        shares: row.shares,
        price: row.price,
        transaction_date: row.transaction_date,
        notes: row.notes ?? null,
        portfolio_name: row.portfolio?.trim() ?? "",
      }));

      return importTransactions(payload, t("portfolio.importedViaCsv"));
    },
    onSuccess: (result) => {
      invalidate();
      setPage(1);
      toast.success(t("portfolio.importedTransactions", { count: result.inserted }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeFilterCount =
    Number(portfolioFilter !== ALL_FILTER) +
    Number(typeFilter !== ALL_FILTER) +
    Number(currencyFilter !== ALL_FILTER) +
    Number(Boolean(dateFromFilter)) +
    Number(Boolean(dateToFilter));

  const clearFilters = () => {
    setTickerFilter("");
    setPortfolioFilter(ALL_FILTER);
    setTypeFilter(ALL_FILTER);
    setCurrencyFilter(ALL_FILTER);
    setDateFromFilter("");
    setDateToFilter("");
    setPage(1);
    setSelected(new Set());
  };

  const updateFilter = (update: () => void) => {
    update();
    setPage(1);
    setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="flex shrink-0 gap-2">
          <details className="relative">
            <summary className="flex h-10 cursor-pointer list-none items-center rounded-lg border border-border/70 bg-card/70 px-4 text-sm font-bold tracking-[0.12em] transition-colors hover:border-primary/60 hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              ••• <span className="sr-only">{t("portfolio.moreActions")}</span>
            </summary>
            <div className="absolute right-0 z-20 mt-2 min-w-56 overflow-hidden rounded-[10px] border border-border/70 bg-popover p-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => setShowImportHelp(true)}
                className="block w-full rounded-md px-3 py-2.5 text-left text-xs uppercase tracking-[0.1em] transition-colors hover:bg-secondary/60 hover:text-primary"
              >
                {t("portfolio.uploadCsv")}
              </button>
              <button
                type="button"
                onClick={() => setShowPortfolios(true)}
                className="block w-full rounded-md px-3 py-2.5 text-left text-xs uppercase tracking-[0.1em] transition-colors hover:bg-secondary/60 hover:text-primary"
              >
                {t("portfolio.managePortfolios")} ({portfolios.length})
              </button>
            </div>
          </details>
          <button
            type="button"
            onClick={() => setEditing(empty())}
            className="h-10 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_10px_28px_-16px_var(--color-primary)] transition-all hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {t("portfolio.addTransactionAction")}
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importM.mutate(file);
          event.target.value = "";
        }}
      />

      <section className="analytics-panel rounded-[10px] border border-border/70 bg-card/70 p-3 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t("portfolio.tickerSearch")}</span>
            <input
              value={tickerFilter}
              onChange={(event) => updateFilter(() => setTickerFilter(event.target.value))}
              placeholder={t("portfolio.activitySearchPlaceholder")}
              className="h-10 w-full rounded-lg border border-border/70 bg-background/70 px-3 text-sm outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowFilters((visible) => !visible)}
            aria-expanded={showFilters}
            className={`h-10 rounded-lg border px-4 text-xs uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
              showFilters || activeFilterCount
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/70 bg-background/50 text-muted-foreground hover:border-primary/60 hover:text-foreground"
            }`}
          >
            {t("portfolio.filters")} {activeFilterCount ? `(${activeFilterCount})` : ""}
          </button>
        </div>

        {showFilters ? (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border/60 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <ActivityFilterSelect
              label={t("portfolio.portfolio")}
              value={portfolioFilter}
              onChange={(value) => updateFilter(() => setPortfolioFilter(value))}
              options={portfolios.map((portfolio) => ({
                value: portfolio.id,
                label: portfolio.name,
              }))}
              allLabel={t("portfolio.all")}
            />
            <ActivityFilterSelect
              label={t("portfolio.type")}
              value={typeFilter}
              onChange={(value) => updateFilter(() => setTypeFilter(value))}
              options={ASSET_TYPES.map((type) => ({ value: type, label: type }))}
              allLabel={t("portfolio.all")}
            />
            <ActivityFilterSelect
              label={t("portfolio.currency")}
              value={currencyFilter}
              onChange={(value) => updateFilter(() => setCurrencyFilter(value))}
              options={currencyOptions.map((currency) => ({ value: currency, label: currency }))}
              allLabel={t("portfolio.all")}
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t("portfolio.dateFrom")}
                </span>
                <input
                  type="date"
                  value={dateFromFilter}
                  onChange={(event) => updateFilter(() => setDateFromFilter(event.target.value))}
                  className="h-10 w-full rounded-lg border border-border/70 bg-background/70 px-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t("portfolio.dateTo")}
                </span>
                <input
                  type="date"
                  value={dateToFilter}
                  onChange={(event) => updateFilter(() => setDateToFilter(event.target.value))}
                  className="h-10 w-full rounded-lg border border-border/70 bg-background/70 px-2 text-sm outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </label>
            </div>
            <div className="sm:col-span-2 xl:col-span-4 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-primary"
              >
                {t("portfolio.clearFilters")}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-bear/30 bg-bear/5 px-4 py-3 text-xs shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
          <span className="font-bold uppercase tracking-widest text-bear">
            {t("portfolio.selectedCount", { count: selected.size })}
          </span>
          <button
            onClick={() => {
              const ids = Array.from(selected);
              setDeleteDialog({
                kind: "bulk-transactions",
                title: t("portfolio.deleteSelected"),
                description: t("portfolio.deleteTransactionsConfirm", { count: selected.size }),
                confirmLabel: t("common.delete"),
                onConfirm: () => bulkDeleteM.mutate(ids),
              });
            }}
            disabled={bulkDeleteM.isPending}
            className="rounded-md border border-bear/60 px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-bear transition-colors hover:bg-bear hover:text-primary-foreground disabled:opacity-50"
          >
            {bulkDeleteM.isPending ? t("portfolio.deleting") : t("portfolio.deleteSelected")}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
          >
            {t("portfolio.cancel")}
          </button>
        </div>
      )}

      <TransactionsTable
        data={data}
        isLoading={isLoading}
        selected={selected}
        setSelected={setSelected}
        portfolioName={portfolioName}
        setEditing={setEditing}
        onDelete={(id, ticker, transactionDate) => {
          setDeleteDialog({
            kind: "transaction",
            title: t("common.delete"),
            description: t("portfolio.deleteTransactionConfirm", { ticker, date: transactionDate }),
            confirmLabel: t("common.delete"),
            onConfirm: () => deleteM.mutate(id),
          });
        }}
      />

      {transactionCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border/70 bg-card/70 px-4 py-3 text-xs uppercase tracking-[0.1em] text-muted-foreground shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
          <div>
            {t("portfolio.transactionsRange", {
              start: pageStart,
              end: pageEnd,
              total: transactionCount,
            })}
          </div>
          <div className="flex items-center gap-2">
            <span>{t("portfolio.pageStatus", { page, total: pageCount })}</span>
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setPage((current) => Math.max(1, current - 1));
              }}
              disabled={page <= 1}
              className="rounded-md border border-border/70 bg-background/40 px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-foreground transition-colors hover:border-primary/60 disabled:opacity-40"
            >
              {t("portfolio.previousPage")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setPage((current) => Math.min(pageCount, current + 1));
              }}
              disabled={page >= pageCount}
              className="rounded-md border border-border/70 bg-background/40 px-3 py-1.5 text-xs uppercase tracking-[0.1em] text-foreground transition-colors hover:border-primary/60 disabled:opacity-40"
            >
              {t("portfolio.nextPage")}
            </button>
          </div>
        </div>
      )}

      {editing && (
        <TransactionEditor
          value={editing}
          portfolios={portfolios}
          tickerSuggestions={tickerSuggestions}
          onClose={() => {
            setEditing(null);
            if (openAddTransaction) onAddHandled?.();
          }}
          busy={createM.isPending || updateM.isPending}
          onSave={(value) => {
            if (editing.id) updateM.mutate({ ...value, id: editing.id });
            else createM.mutate(value);
          }}
        />
      )}

      {showImportHelp ? (
        <ImportCsvDialog
          busy={importM.isPending}
          onClose={() => setShowImportHelp(false)}
          onChoose={() => {
            setShowImportHelp(false);
            fileRef.current?.click();
          }}
        />
      ) : null}

      {showPortfolios && (
        <PortfoliosModal
          portfolios={portfolios}
          onClose={() => setShowPortfolios(false)}
          onCreate={async (value) => {
            try {
              await createP.mutateAsync(value);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
          onRequestDelete={(portfolio) =>
            setDeleteDialog({
              kind: "portfolio",
              title: t("common.delete"),
              description: t("portfolio.deletePortfolioConfirm", { name: portfolio.name }),
              confirmLabel: t("common.delete"),
              onConfirm: () => delP.mutate(portfolio.id),
            })
          }
        />
      )}

      <ConfirmDialog
        open={deleteDialog != null}
        title={deleteDialog?.title ?? t("common.delete")}
        description={deleteDialog?.description ?? ""}
        confirmLabel={deleteDialog?.confirmLabel ?? t("common.delete")}
        isConfirming={
          deleteDialog?.kind === "transaction"
            ? deleteM.isPending
            : deleteDialog?.kind === "bulk-transactions"
              ? bulkDeleteM.isPending
              : deleteDialog?.kind === "portfolio"
                ? delP.isPending
                : false
        }
        onCancel={() => setDeleteDialog(null)}
        onConfirm={() => deleteDialog?.onConfirm()}
      />
    </div>
  );
}

function ActivityFilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <TerminalSelect
        value={value}
        onChange={onChange}
        ariaLabel={label}
        options={[{ value: ALL_FILTER, label: allLabel }, ...options]}
      />
    </div>
  );
}

function ImportCsvDialog({
  busy,
  onClose,
  onChoose,
}: {
  busy: boolean;
  onClose: () => void;
  onChoose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-import-title"
    >
      <div className="analytics-panel w-full max-w-2xl overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 bg-secondary/25 px-5 py-4">
          <h2 id="csv-import-title" className="text-xs uppercase tracking-[0.16em] text-primary">
            {t("portfolio.csvFormatHelp")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.cancel")}
            className="h-8 w-8 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            ×
          </button>
        </div>
        <div className="space-y-3 p-4 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">{t("portfolio.requiredColumns")}</strong> ticker,
            shares, price, portfolio.
          </p>
          <p>
            <strong className="text-foreground">{t("portfolio.optionalColumns")}</strong>{" "}
            transaction_date, asset_type, currency, notes.
          </p>
          <p>
            <strong className="text-foreground">{t("portfolio.tickers")}</strong> AAPL, AIR.PA,
            VOD.L, BTC-USD.
          </p>
          <pre className="overflow-x-auto rounded-lg border border-border/70 bg-background/70 p-4 text-xs">
            {`transaction_date,ticker,asset_type,currency,shares,price,portfolio
2024-01-15,AAPL,stock,USD,10,150.20,IBKR
2024-06-03,AAPL,stock,USD,5,185.40,IBKR
2024-03-10,AIR.PA,stock,EUR,5,128.40,Degiro`}
          </pre>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-border/70 px-4 text-xs uppercase tracking-[0.12em] transition-colors hover:border-primary/60"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={onChoose}
              disabled={busy}
              className="h-10 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_10px_28px_-16px_var(--color-primary)] transition-all hover:-translate-y-0.5 hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t("portfolio.importing") : t("portfolio.chooseCsv")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfoliosModal({
  portfolios,
  onClose,
  onCreate,
  onRequestDelete,
}: {
  portfolios: PortfolioRecord[];
  onClose: () => void;
  onCreate: (v: PortfolioInputType) => Promise<void>;
  onRequestDelete: (portfolio: PortfolioRecord) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [broker, setBroker] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur md:items-center">
      <div className="analytics-panel w-full max-w-md overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xl">
        <div className="flex justify-between border-b border-border/60 bg-secondary/25 px-5 py-4 text-xs uppercase tracking-[0.12em] text-primary">
          <span>{t("portfolio.portfoliosTitle")}</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            x
          </button>
        </div>

        <div className="space-y-4 p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!name.trim()) return;
              await onCreate({
                name: name.trim(),
                broker: broker.trim() || null,
                notes: notes.trim() || null,
              });
              setName("");
              setBroker("");
              setNotes("");
            }}
            className="grid grid-cols-2 gap-2"
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={t("portfolio.portfolioNamePlaceholder")}
              className="col-span-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <input
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              placeholder={t("portfolio.portfolioBrokerPlaceholder")}
              className="col-span-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("portfolio.portfolioNotesPlaceholder")}
              className="col-span-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            <button
              type="submit"
              className="col-span-2 rounded-lg bg-primary px-3 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_10px_28px_-16px_var(--color-primary)] transition-all hover:-translate-y-0.5 hover:opacity-90"
            >
              {t("portfolio.addPortfolio")}
            </button>
          </form>

          <div className="overflow-hidden rounded-lg border border-border/70 bg-background/30">
            {portfolios.length === 0 && (
              <div className="p-3 text-center text-xs text-muted-foreground">
                {t("portfolio.noPortfoliosYet")}
              </div>
            )}
            {portfolios.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-t border-border/50 px-4 py-3 text-xs transition-colors first:border-t-0 hover:bg-secondary/25"
              >
                <div>
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("portfolio.broker")}: {p.broker || "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("portfolio.notes")}: {p.notes || "-"}
                  </div>
                </div>
                <button
                  onClick={() => onRequestDelete(p)}
                  className="text-xs text-destructive hover:underline"
                >
                  [x]
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/portfolio/transactions")({
  beforeLoad: () => {
    throw redirect({ to: "/portfolio/activity", replace: true });
  },
});
