import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/terminal/StatCard";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { TerminalTable } from "@/components/terminal/TerminalTable";
import { supabase } from "@/integrations/supabase/client";
import { fmt, fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import { upsertTickerCatalogEntry } from "@/lib/portfolio/tickerCatalog";
import { type TransactionInputType } from "@/lib/portfolio/transactions/api";
import { TransactionEditor } from "@/routes/_authenticated/portfolio/components/TransactionEditor";
import { usePortfolioHoldingsView } from "@/routes/_authenticated/portfolio/hooks/usePortfolioHoldingsView";
import { useTickerCatalog } from "@/routes/_authenticated/portfolio/hooks/useTickerCatalog";

export const Route = createFileRoute("/_authenticated/portfolio/holdings/$ticker")({
  component: HoldingDetailsPage,
});

function HoldingDetailsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { ticker } = Route.useParams();
  const normalizedTicker = ticker.trim().toUpperCase();
  const [editing, setEditing] = useState<(TransactionInputType & { id?: string }) | null>(null);
  const [txSortDirection, setTxSortDirection] = useState<"asc" | "desc">("desc");
  const {
    txQ,
    quotesQ,
    transactions,
    portfolios,
    allRows,
    display,
    setDisplay,
    portfolioMap,
    convert,
  } = usePortfolioHoldingsView();
  const { tickerCatalog } = useTickerCatalog();

  const holdingRows = useMemo(
    () => allRows.filter((row) => row.ticker.trim().toUpperCase() === normalizedTicker),
    [allRows, normalizedTicker],
  );
  const holdingTransactions = useMemo(
    () => transactions.filter((row) => row.ticker.trim().toUpperCase() === normalizedTicker),
    [normalizedTicker, transactions],
  );
  const sortedTransactions = useMemo(() => {
    const rows = holdingTransactions.slice();
    rows.sort((a, b) =>
      txSortDirection === "asc"
        ? a.transaction_date.localeCompare(b.transaction_date)
        : b.transaction_date.localeCompare(a.transaction_date),
    );
    return rows;
  }, [holdingTransactions, txSortDirection]);

  const portfolioTotalMarketValue = useMemo(
    () => allRows.reduce((sum, row) => sum + convert(row.marketValue, row._nativeCurrency), 0),
    [allRows, convert],
  );

  const holdingCurrency = holdingRows[0]?._nativeCurrency ?? "USD";

  useEffect(() => {
    if (display !== holdingCurrency) {
      setDisplay(holdingCurrency);
    }
  }, [display, holdingCurrency, setDisplay]);

  const summary = useMemo(() => {
    const totalQuantity = holdingRows.reduce((sum, row) => sum + Number(row.shares), 0);
    const marketValue = holdingRows.reduce(
      (sum, row) => sum + convert(row.marketValue, row._nativeCurrency),
      0,
    );
    const costBasis = holdingRows.reduce(
      (sum, row) => sum + convert(row.costBasis, row._nativeCurrency),
      0,
    );
    const unrealized = marketValue - costBasis;
    const dailyChange = holdingRows.reduce(
      (sum, row) => sum + convert(row.dayChange, row._nativeCurrency),
      0,
    );
    const currentPrice = totalQuantity > 0 ? marketValue / totalQuantity : 0;
    const averagePrice = totalQuantity > 0 ? costBasis / totalQuantity : 0;
    const allocationPct = portfolioTotalMarketValue
      ? (marketValue / portfolioTotalMarketValue) * 100
      : 0;
    const first = holdingRows[0] ?? null;

    return {
      ticker: first?.ticker ?? normalizedTicker,
      companyName: first?.quote?.shortName || first?.name || normalizedTicker,
      assetType: formatAssetType(first?.asset_type ?? ""),
      currentPrice,
      averagePrice,
      quantityHeld: totalQuantity,
      marketValue,
      costBasis,
      unrealized,
      unrealizedPct: costBasis ? (unrealized / costBasis) * 100 : 0,
      allocationPct,
      dailyChange,
      totalGainLoss: unrealized,
      positionReturnPct: costBasis ? (unrealized / costBasis) * 100 : 0,
      currency: holdingCurrency,
      market: first?.market ?? null,
    };
  }, [convert, holdingCurrency, holdingRows, normalizedTicker, portfolioTotalMarketValue]);

  const breakdownRows = useMemo(() => {
    const groups = new Map<
      string,
      {
        portfolioId: string | null;
        quantity: number;
        marketValue: number;
        costBasis: number;
      }
    >();

    for (const row of holdingRows) {
      const key = row.portfolio_id ?? "__unassigned__";
      const current = groups.get(key) ?? {
        portfolioId: row.portfolio_id ?? null,
        quantity: 0,
        marketValue: 0,
        costBasis: 0,
      };
      current.quantity += Number(row.shares);
      current.marketValue += convert(row.marketValue, row._nativeCurrency);
      current.costBasis += convert(row.costBasis, row._nativeCurrency);
      groups.set(key, current);
    }

    return Array.from(groups.values())
      .map((row) => ({
        ...row,
        averagePrice: row.quantity > 0 ? row.costBasis / row.quantity : 0,
        unrealized: row.marketValue - row.costBasis,
      }))
      .sort((a, b) => b.marketValue - a.marketValue);
  }, [convert, holdingRows]);
  const showPortfolioBreakdown = breakdownRows.length > 1;

  const tickerSuggestions = useMemo(() => {
    const map = new Map<
      string,
      {
        ticker: string;
        name: string | null;
        asset_type: string | null;
        market: string | null;
        currency: string | null;
      }
    >();

    for (const row of tickerCatalog) {
      const key = row.ticker.trim().toUpperCase();
      if (!key) continue;
      map.set(key, {
        ticker: key,
        name: row.name ?? null,
        asset_type: row.asset_type ?? null,
        market: row.market ?? null,
        currency: row.currency ?? null,
      });
    }

    for (const row of holdingRows) {
      const key = row.ticker.trim().toUpperCase();
      map.set(key, {
        ticker: key,
        name: row.quote?.shortName || row.name || null,
        asset_type: row.asset_type ?? null,
        market: row.market ?? null,
        currency: row._nativeCurrency ?? null,
      });
    }

    return Array.from(map.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [holdingRows, tickerCatalog]);

  const createM = useMutation({
    mutationFn: async (value: TransactionInputType) => {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw new Error(authError.message);
      const userId = data.user?.id;
      if (!userId) throw new Error(t("portfolio.mustBeLoggedIn"));

      const { error } = await supabase.from("transactions").insert([{ ...value, user_id: userId }]);
      if (error) throw new Error(error.message);
      await upsertTickerCatalogEntry(userId, value);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["positions"] });
      qc.invalidateQueries({ queryKey: ["portfolios"] });
      qc.invalidateQueries({ queryKey: ["ticker-catalog"] });
      setEditing(null);
      toast.success(t("portfolio.transactionAdded"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (txQ.isLoading || quotesQ.isLoading || display !== holdingCurrency) {
    return <HoldingDetailsSkeleton />;
  }
  if (holdingRows.length === 0) return <HoldingDetailsMissing ticker={normalizedTicker} />;

  const addTransactionDraft = makeTransactionDraft(summary, breakdownRows, portfolios);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl uppercase tracking-[0.2em]">{`> ${summary.ticker}`}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{summary.companyName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing(addTransactionDraft)}
            className="bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90"
          >
            {t("portfolio.addTransactionAction")}
          </button>
        </div>
      </div>

      <HoldingSection title={t("portfolio.summarySection")}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard label={t("portfolio.ticker")} value={summary.ticker} />
          <StatCard label={t("portfolio.name")} value={summary.companyName} />
          <StatCard label={t("portfolio.assetType")} value={summary.assetType} />
          <StatCard
            label={t("portfolio.currentPrice")}
            value={fmtCurrency(summary.currentPrice, summary.currency)}
          />
          <StatCard
            label={t("portfolio.averagePrice")}
            value={fmtCurrency(summary.averagePrice, summary.currency)}
          />
          <StatCard
            label={t("portfolio.quantityHeld")}
            value={fmt(summary.quantityHeld, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 4,
            })}
          />
          <StatCard
            label={t("portfolio.marketValue")}
            value={fmtCurrency(summary.marketValue, summary.currency)}
            accent
          />
          <StatCard
            label={t("portfolio.costBasis")}
            value={fmtCurrency(summary.costBasis, summary.currency)}
          />
          <StatCard
            label={t("portfolio.unrealized")}
            value={fmtCurrency(summary.unrealized, summary.currency)}
            sub={fmtPct(summary.unrealizedPct)}
            tone={summary.unrealized >= 0 ? "bull" : "bear"}
          />
          <StatCard
            label={t("portfolio.portfolioAllocationPct")}
            value={fmtPct(summary.allocationPct)}
          />
        </div>
      </HoldingSection>

      <HoldingSection title={t("portfolio.performanceSection")}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <StatCard
            label={t("portfolio.dailyChange")}
            value={fmtCurrency(summary.dailyChange, summary.currency)}
            tone={summary.dailyChange >= 0 ? "bull" : "bear"}
          />
          <StatCard
            label={t("portfolio.totalGainLoss")}
            value={fmtCurrency(summary.totalGainLoss, summary.currency)}
            tone={summary.totalGainLoss >= 0 ? "bull" : "bear"}
          />
          <StatCard
            label={t("portfolio.positionReturnPct")}
            value={fmtPct(summary.positionReturnPct)}
            tone={summary.positionReturnPct >= 0 ? "bull" : "bear"}
          />
        </div>
      </HoldingSection>

      {showPortfolioBreakdown ? (
        <HoldingSection title={t("portfolio.portfolioBreakdown")}>
          <TerminalCard bodyClassName="p-0">
            <div className="overflow-x-auto">
              <TerminalTable>
                <thead className="bg-secondary/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">{t("portfolio.portfolio")}</th>
                    <th className="px-3 py-2 text-right">{t("portfolio.quantity")}</th>
                    <th className="px-3 py-2 text-right">{t("portfolio.averagePrice")}</th>
                    <th className="px-3 py-2 text-right">{t("portfolio.marketValue")}</th>
                    <th className="px-3 py-2 text-right">{t("portfolio.unrealized")}</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row) => (
                    <tr
                      key={row.portfolioId ?? "__unassigned__"}
                      className="border-t border-border/60"
                    >
                      <td className="px-3 py-2">
                        {row.portfolioId
                          ? (portfolioMap.get(row.portfolioId) ?? "-")
                          : t("portfolio.unassigned")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmt(row.quantity, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtCurrency(row.averagePrice, summary.currency)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtCurrency(row.marketValue, summary.currency)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${
                          row.unrealized >= 0 ? "text-bull" : "text-bear"
                        }`}
                      >
                        {fmtCurrency(row.unrealized, summary.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </TerminalTable>
            </div>
          </TerminalCard>
        </HoldingSection>
      ) : null}

      <HoldingSection title={t("portfolio.transactionsSection")}>
        <TerminalCard bodyClassName="p-0">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {holdingTransactions.length} {t("header.transactions")}
            </div>
            <button
              type="button"
              onClick={() =>
                setTxSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))
              }
              className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
            >
              {t("portfolio.date")} {txSortDirection === "asc" ? "↑" : "↓"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <TerminalTable>
              <thead className="bg-secondary/20 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">{t("portfolio.date")}</th>
                  <th className="px-3 py-2 text-left">{t("portfolio.action")}</th>
                  <th className="px-3 py-2 text-left">{t("portfolio.portfolio")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.quantity")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.price")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.fees")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.total")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {t("portfolio.noTransactionsYet")}
                    </td>
                  </tr>
                ) : (
                  sortedTransactions.map((transaction) => {
                    const totalValue = Number(transaction.shares) * Number(transaction.price);
                    const feeValue = (transaction.action ?? "buy") === "fee" ? totalValue : null;
                    return (
                      <tr
                        key={transaction.id}
                        className="border-t border-border/60 hover:bg-secondary/30"
                      >
                        <td className="px-3 py-2 tabular-nums">{transaction.transaction_date}</td>
                        <td className="px-3 py-2 uppercase">
                          {t(`portfolio.action${capitalizeAction(transaction.action ?? "buy")}`)}
                        </td>
                        <td className="px-3 py-2">
                          {transaction.portfolio_id
                            ? (portfolioMap.get(transaction.portfolio_id) ?? "-")
                            : t("portfolio.unassigned")}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmt(Number(transaction.shares), {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 4,
                          })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtCurrency(Number(transaction.price), transaction.currency)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {feeValue == null ? "-" : fmtCurrency(feeValue, transaction.currency)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmtCurrency(totalValue, transaction.currency)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </TerminalTable>
          </div>
        </TerminalCard>
      </HoldingSection>

      {editing ? (
        <TransactionEditor
          value={editing}
          portfolios={portfolios}
          tickerSuggestions={tickerSuggestions}
          busy={createM.isPending}
          onClose={() => setEditing(null)}
          onSave={(value) => createM.mutate(value)}
        />
      ) : null}
    </div>
  );
}

function HoldingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[10px] uppercase tracking-[0.3em] text-primary">{`> ${title}`}</h2>
      {children}
    </section>
  );
}

function HoldingDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 border border-border bg-card animate-pulse" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="h-24 border border-border bg-card animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 border border-border bg-card animate-pulse" />
        ))}
      </div>
      <div className="h-72 border border-border bg-card animate-pulse" />
    </div>
  );
}

function HoldingDetailsMissing({ ticker }: { ticker: string }) {
  const { t } = useTranslation();

  return (
    <div className="border border-dashed border-border p-12 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] text-primary">
        {t("portfolio.holdingNotFound")}
      </div>
      <h2 className="mt-3 text-2xl">{ticker}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("portfolio.noHoldingMatch")}</p>
      <Link
        to="/portfolio/holdings"
        className="inline-block mt-6 bg-primary px-6 py-2 text-xs font-bold uppercase tracking-[0.25em] text-primary-foreground hover:opacity-90"
      >
        {t("portfolio.holdings")}
      </Link>
    </div>
  );
}

function makeTransactionDraft(
  summary: {
    ticker: string;
    companyName: string;
    assetType: string;
    currency: string;
    market: string | null;
  },
  breakdownRows: Array<{ portfolioId: string | null }>,
  portfolios: Array<{ id: string; name: string }>,
): TransactionInputType {
  const today = new Date().toISOString().slice(0, 10);
  const uniquePortfolioId =
    breakdownRows.length === 1 && breakdownRows[0]?.portfolioId
      ? breakdownRows[0].portfolioId
      : portfolios.length === 1
        ? portfolios[0].id
        : null;

  return {
    ticker: summary.ticker,
    action: "buy",
    name: summary.companyName,
    asset_type: parseAssetType(summary.assetType),
    market: summary.market,
    currency: summary.currency,
    shares: 0,
    price: 0,
    transaction_date: today,
    notes: "",
    portfolio_id: uniquePortfolioId,
  };
}

function parseAssetType(value: string): TransactionInputType["asset_type"] {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "stock" ||
    normalized === "etf" ||
    normalized === "crypto" ||
    normalized === "bond" ||
    normalized === "fund" ||
    normalized === "other"
  ) {
    return normalized;
  }
  return "stock";
}

function formatAssetType(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function capitalizeAction(action: string) {
  return action.charAt(0).toUpperCase() + action.slice(1);
}
