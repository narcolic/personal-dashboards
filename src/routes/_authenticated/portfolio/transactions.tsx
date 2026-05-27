import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { mapCsvRows, parseCSV } from "@/lib/csv";
import { type PortfolioInputType } from "@/lib/portfolio/portfolios/api";
import { type TransactionInputType } from "@/lib/portfolio/transactions/api";
import { TransactionsTable } from "@/routes/_authenticated/portfolio/components/TransactionsTable";
import { TransactionEditor } from "@/routes/_authenticated/portfolio/components/TransactionEditor";
import { type PortfolioRecord, usePortfolioData } from "@/routes/_authenticated/portfolio/hooks/usePortfolioData";

const ASSET_TYPES = ["stock", "etf", "crypto", "bond", "fund", "other"] as const;
const today = () => new Date().toISOString().slice(0, 10);

const empty = (): TransactionInputType => ({
  ticker: "",
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
  name: string | null;
  asset_type: string;
  currency: string;
  shares: number;
  price: number;
  transaction_date: string;
  notes: string | null;
  portfolio_id: string | null;
};

function TransactionsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<(TransactionInputType & { id?: string }) | null>(null);
  const [showPortfolios, setShowPortfolios] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { txQ, transactions, portfolios } = usePortfolioData();
  const data = transactions as TransactionTableRow[];
  const isLoading = txQ.isLoading;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["positions"] });
    qc.invalidateQueries({ queryKey: ["portfolios"] });
  };

  const getCurrentUserId = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw new Error(error.message);
    const userId = data.user?.id;
    if (!userId) throw new Error(t("portfolio.mustBeLoggedIn"));
    return userId;
  };

  const portfolioName = useMemo(() => {
    const map = new Map(portfolios.map((p) => [p.id, p.name]));
    return (id: string | null) => (id ? (map.get(id) ?? "-") : t("portfolio.unassigned"));
  }, [portfolios]);

  const createM = useMutation({
    mutationFn: async (value: TransactionInputType) => {
      const userId = await getCurrentUserId();
      const { error } = await supabase.from("transactions").insert([{ ...value, user_id: userId }]);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      setEditing(null);
      toast.success(t("portfolio.transactionAdded"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateM = useMutation({
    mutationFn: async (value: TransactionInputType & { id: string }) => {
      const { id, ...rest } = value;
      const { error } = await supabase.from("transactions").update(rest).eq("id", id);

      if (error) throw new Error(error.message);
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
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("portfolio.removed"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteM = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("transactions").delete().in("id", ids);
      if (error) throw new Error(error.message);
      return { deleted: ids.length };
    },
    onSuccess: (result) => {
      invalidate();
      setSelected(new Set());
      toast.success(t("portfolio.deletedTransactions", { count: result.deleted }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createP = useMutation({
    mutationFn: async (value: PortfolioInputType) => {
      const userId = await getCurrentUserId();
      const { error } = await supabase.from("portfolios").insert([{ ...value, user_id: userId }]);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("portfolio.portfolioAdded"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delP = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolios").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("portfolio.portfolioRemoved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importM = useMutation({
    mutationFn: async (file: File) => {
      const userId = await getCurrentUserId();
      const text = await file.text();
      const parsed = parseCSV(text);
      const { rows, errors } = mapCsvRows(parsed);

      if (errors.length > 0) {
        errors.slice(0, 3).forEach((error) => toast.error(error));
      }
      if (rows.length === 0) {
        throw new Error(t("portfolio.noValidRows"));
      }

      const { data: userPortfolios, error: pfError } = await supabase
        .from("portfolios")
        .select("id,name")
        .eq("user_id", userId);
      if (pfError) throw new Error(pfError.message);

      const portfolioIdByName = new Map<string, string>();
      for (const p of userPortfolios ?? []) {
        if (p.name) portfolioIdByName.set(p.name.trim().toLowerCase(), p.id);
      }

      const csvPortfolioNames = Array.from(
        new Set(
          rows.map((row) => row.portfolio?.trim()).filter((name): name is string => Boolean(name)),
        ),
      );

      for (const portfolioName of csvPortfolioNames) {
        const key = portfolioName.toLowerCase();
        if (portfolioIdByName.has(key)) continue;

        const { data: created, error: createPfError } = await supabase
          .from("portfolios")
          .insert([
            {
              name: portfolioName,
              broker: portfolioName,
              notes: t("portfolio.importedViaCsv"),
              user_id: userId,
            },
          ])
          .select("id,name")
          .single();
        if (createPfError) throw new Error(createPfError.message);
        portfolioIdByName.set(key, created.id);
      }

      const payload = rows.map((row) => {
        const portfolioName = row.portfolio?.trim();
        const portfolioId = portfolioName
          ? (portfolioIdByName.get(portfolioName.toLowerCase()) ?? null)
          : null;
        if (!portfolioId) {
          throw new Error(t("portfolio.couldNotResolvePortfolio", { name: portfolioName ?? "" }));
        }

        return {
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
          portfolio_id: portfolioId,
          user_id: userId,
        };
      });

      const { error } = await supabase.from("transactions").insert(payload);
      if (error) throw new Error(error.message);
      return { inserted: payload.length };
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(t("portfolio.importedTransactions", { count: result.inserted }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl uppercase tracking-[0.2em]">{t("portfolio.transactionsTitle")}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("portfolio.transactionsSubtitle")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowPortfolios(true)}
            className="border border-border px-3 py-2 text-[11px] uppercase tracking-[0.2em] hover:border-primary"
          >
            {t("portfolio.portfolios")} ({portfolios.length})
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importM.mutate(file);
              e.target.value = "";
            }}
          />

          <button
            onClick={() => fileRef.current?.click()}
            disabled={importM.isPending}
            className="border border-border px-3 py-2 text-[11px] uppercase tracking-[0.2em] hover:border-primary disabled:opacity-50"
          >
            {importM.isPending ? t("portfolio.importing") : t("portfolio.uploadCsv")}
          </button>

          <button
            onClick={() => setEditing(empty())}
            className="bg-primary px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90"
          >
            {t("portfolio.new")}
          </button>
        </div>
      </div>

      <details className="border border-border bg-card/50 text-[11px]">
        <summary className="cursor-pointer px-3 py-2 uppercase tracking-[0.2em] text-muted-foreground hover:text-primary">
          {t("portfolio.csvFormatHelp")}
        </summary>
        <div className="space-y-1 px-3 pb-3 text-muted-foreground">
          <p>
            <strong className="text-foreground">{t("portfolio.requiredColumns")}</strong> ticker, shares, price,
            portfolio.
          </p>
          <p>
            <strong className="text-foreground">{t("portfolio.optionalColumns")}</strong> transaction_date, asset_type,
            currency, notes.
          </p>
          <p>
            <strong className="text-foreground">{t("portfolio.tickers")}</strong> AAPL, AIR.PA, VOD.L, BTC-USD.
          </p>
          <pre className="mt-2 overflow-x-auto border border-border bg-background p-2">
            {`transaction_date,ticker,asset_type,currency,shares,price,portfolio
2024-01-15,AAPL,stock,USD,10,150.20,IBKR
2024-06-03,AAPL,stock,USD,5,185.40,IBKR
2024-03-10,AIR.PA,stock,EUR,5,128.40,Degiro
2023-11-01,BTC-USD,crypto,USD,0.5,35000,Coinbase`}
          </pre>
        </div>
      </details>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 border border-bear/30 bg-bear/5 px-3 py-2 text-[11px]">
          <span className="font-bold uppercase tracking-widest text-bear">
            {t("portfolio.selectedCount", { count: selected.size })}
          </span>
          <button
            onClick={() => {
              if (confirm(t("portfolio.deleteTransactionsConfirm", { count: selected.size }))) {
                bulkDeleteM.mutate(Array.from(selected));
              }
            }}
            disabled={bulkDeleteM.isPending}
            className="border border-bear px-3 py-1 text-[10px] uppercase tracking-widest text-bear hover:bg-bear hover:text-white disabled:opacity-50"
          >
            {bulkDeleteM.isPending ? t("portfolio.deleting") : t("portfolio.deleteSelected")}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
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
          if (confirm(t("portfolio.deleteTransactionConfirm", { ticker, date: transactionDate }))) {
            deleteM.mutate(id);
          }
        }}
      />

      {editing && (
        <TransactionEditor
          value={editing}
          portfolios={portfolios}
          onClose={() => setEditing(null)}
          busy={createM.isPending || updateM.isPending}
          onSave={(value) => {
            if (editing.id) updateM.mutate({ ...value, id: editing.id });
            else createM.mutate(value);
          }}
        />
      )}

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
          onDelete={async (id) => {
            try {
              await delP.mutateAsync(id);
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        />
      )}
    </div>
  );
}

function PortfoliosModal({
  portfolios,
  onClose,
  onCreate,
  onDelete,
}: {
  portfolios: PortfolioRecord[];
  onClose: () => void;
  onCreate: (v: PortfolioInputType) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [broker, setBroker] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur md:items-center">
      <div className="w-full max-w-md border border-border bg-card">
        <div className="flex justify-between border-b border-border bg-secondary/40 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-primary">
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
              className="col-span-2 border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
            <input
              value={broker}
              onChange={(e) => setBroker(e.target.value)}
              placeholder={t("portfolio.portfolioBrokerPlaceholder")}
              className="col-span-2 border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("portfolio.portfolioNotesPlaceholder")}
              className="col-span-2 border border-border bg-input px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              className="col-span-2 bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90"
            >
              {t("portfolio.addPortfolio")}
            </button>
          </form>

          <div className="border border-border">
            {portfolios.length === 0 && (
              <div className="p-3 text-center text-[11px] text-muted-foreground">
                {t("portfolio.noPortfoliosYet")}
              </div>
            )}
            {portfolios.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-t border-border/60 px-3 py-2 text-[12px] first:border-t-0"
              >
                <div>
                  <div className="font-bold">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{t("portfolio.broker")}: {p.broker || "-"}</div>
                  <div className="text-[10px] text-muted-foreground">{t("portfolio.notes")}: {p.notes || "-"}</div>
                </div>
                <button
                  onClick={() => {
                    if (
                      confirm(t("portfolio.deletePortfolioConfirm", { name: p.name }))
                    ) {
                      onDelete(p.id);
                    }
                  }}
                  className="text-[10px] uppercase text-bear hover:underline"
                >
                    {t("common.deleteShort")}
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
  component: TransactionsPage,
});
