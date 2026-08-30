import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/terminal/StatCard";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { TerminalTable } from "@/components/terminal/TerminalTable";
import { fmt, fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import { invalidatePortfolioData } from "@/lib/portfolio/queries";
import { createTransaction, type TransactionInputType } from "@/lib/portfolio/transactions/api";
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
  const { txQ, holdingsQ, quotesQ, transactions, portfolios, allRows, portfolioMap, convertTo } =
    usePortfolioHoldingsView();
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

  const holdingCurrency = holdingRows[0]?._nativeCurrency ?? "USD";

  const portfolioTotalMarketValue = useMemo(
    () =>
      allRows.reduce(
        (sum, row) => sum + convertTo(row.marketValue, row._nativeCurrency, holdingCurrency),
        0,
      ),
    [allRows, convertTo, holdingCurrency],
  );

  const summary = useMemo(() => {
    const totalQuantity = holdingRows.reduce((sum, row) => sum + Number(row.shares), 0);
    const marketValue = holdingRows.reduce(
      (sum, row) => sum + convertTo(row.marketValue, row._nativeCurrency, holdingCurrency),
      0,
    );
    const costBasis = holdingRows.reduce(
      (sum, row) => sum + convertTo(row.costBasis, row._nativeCurrency, holdingCurrency),
      0,
    );
    const unrealized = marketValue - costBasis;
    const dailyChange = holdingRows.reduce(
      (sum, row) => sum + convertTo(row.dayChange, row._nativeCurrency, holdingCurrency),
      0,
    );
    const previousMarketValue = marketValue - dailyChange;
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
      dailyChangePct: previousMarketValue ? (dailyChange / previousMarketValue) * 100 : 0,
      totalGainLoss: unrealized,
      positionReturnPct: costBasis ? (unrealized / costBasis) * 100 : 0,
      currency: holdingCurrency,
      market: first?.market ?? null,
    };
  }, [convertTo, holdingCurrency, holdingRows, normalizedTicker, portfolioTotalMarketValue]);
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
      current.marketValue += convertTo(row.marketValue, row._nativeCurrency, holdingCurrency);
      current.costBasis += convertTo(row.costBasis, row._nativeCurrency, holdingCurrency);
      groups.set(key, current);
    }

    return Array.from(groups.values())
      .map((row) => ({
        ...row,
        averagePrice: row.quantity > 0 ? row.costBasis / row.quantity : 0,
        unrealized: row.marketValue - row.costBasis,
      }))
      .sort((a, b) => b.marketValue - a.marketValue);
  }, [convertTo, holdingCurrency, holdingRows]);
  const showPortfolioBreakdown = breakdownRows.length > 1;
  const holdingPortfolioNames = useMemo(() => {
    const names = breakdownRows.map((row) =>
      row.portfolioId ? (portfolioMap.get(row.portfolioId) ?? "-") : t("portfolio.unassigned"),
    );

    return Array.from(new Set(names)).join(", ");
  }, [breakdownRows, portfolioMap, t]);

  const tickerSuggestions = useMemo(() => {
    const map = new Map<
      string,
      {
        ticker: string;
        name: string | null;
        asset_type: string | null;
        market: string | null;
        currency: string | null;
        security_listing_id: string | null;
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
        security_listing_id: row.security_listing_id ?? null,
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
        security_listing_id: row.security_listing_id ?? null,
      });
    }

    return Array.from(map.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [holdingRows, tickerCatalog]);

  const createM = useMutation({
    mutationFn: async (value: TransactionInputType) => {
      await createTransaction(value);
    },
    onSuccess: () => {
      invalidatePortfolioData(qc);
      setEditing(null);
      toast.success(t("portfolio.transactionAdded"));
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (txQ.isLoading || holdingsQ.isLoading || quotesQ.isLoading) {
    return <HoldingDetailsSkeleton />;
  }
  if (holdingRows.length === 0) return <HoldingDetailsMissing ticker={normalizedTicker} />;

  const addTransactionDraft = makeTransactionDraft(summary, breakdownRows, portfolios);

  return (
    <div className="space-y-6">
      <Link
        to="/portfolio"
        hash="holdings"
        className="inline-flex rounded-md px-2 py-1 text-xs uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-secondary/35 hover:text-primary"
      >
        ← {t("header.portfolio")} / {t("portfolio.holdings")}
      </Link>
      <div className="analytics-panel rounded-[10px] bg-card/60 px-5 py-5 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] md:px-6">
        <div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-primary">{summary.ticker}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{summary.companyName}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <span className="rounded-full bg-secondary/35 px-3 py-1.5">
                  {t("portfolio.assetType")}: {summary.assetType}
                </span>
                <span className="rounded-full bg-secondary/35 px-3 py-1.5">
                  {t("portfolio.currency")}: {summary.currency}
                </span>
                <span className="rounded-full bg-secondary/35 px-3 py-1.5">
                  {t("portfolio.heldIn")}: {holdingPortfolioNames}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(addTransactionDraft)}
                className="h-10 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_10px_28px_-16px_var(--color-primary)] transition-all hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {t("portfolio.addTransactionAction")}
              </button>
            </div>
          </div>
        </div>
      </div>

      <HoldingSection title={t("portfolio.performanceSection")}>
        <TerminalCard bodyClassName="p-0">
          <div className="grid grid-cols-1 xl:grid-cols-3">
            <div className="bg-primary/[0.035]">
              <StatCard
                label={t("portfolio.marketValue")}
                value={fmtCurrency(summary.marketValue, summary.currency)}
                accent
                size="featured"
                surface="flat"
              />
            </div>
            <div className="border-t border-border/50 xl:border-t-0 xl:border-l">
              <StatCard
                label={t("portfolio.dailyChange")}
                value={fmtCurrency(summary.dailyChange, summary.currency)}
                sub={fmtPct(summary.dailyChangePct)}
                tone={summary.dailyChange >= 0 ? "bull" : "bear"}
                size="featured"
                surface="flat"
              />
            </div>
            <div className="border-t border-border/50 xl:border-t-0 xl:border-l">
              <StatCard
                label={t("portfolio.unrealized")}
                value={fmtCurrency(summary.unrealized, summary.currency)}
                sub={fmtPct(summary.unrealizedPct)}
                tone={summary.unrealized >= 0 ? "bull" : "bear"}
                size="featured"
                surface="flat"
              />
            </div>
          </div>
        </TerminalCard>
      </HoldingSection>

      <HoldingSection title={t("portfolio.positionDetailsSection")}>
        <TerminalCard bodyClassName="p-0">
          <div className="grid grid-cols-1 divide-y divide-border/50 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
            <StatCard
              label={t("portfolio.quantityHeld")}
              value={fmt(summary.quantityHeld, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 4,
              })}
              surface="flat"
            />
            <StatCard
              label={t("portfolio.averagePrice")}
              value={fmtCurrency(summary.averagePrice, summary.currency)}
              surface="flat"
            />
            <StatCard
              label={t("portfolio.currentPrice")}
              value={fmtCurrency(summary.currentPrice, summary.currency)}
              surface="flat"
            />
            <StatCard
              label={t("portfolio.costBasis")}
              value={fmtCurrency(summary.costBasis, summary.currency)}
              surface="flat"
            />
            <StatCard
              label={t("portfolio.portfolioAllocationPct")}
              value={fmtPct(summary.allocationPct)}
              surface="flat"
            />
          </div>
        </TerminalCard>
      </HoldingSection>

      {showPortfolioBreakdown ? (
        <HoldingSection title={t("portfolio.portfolioBreakdown")}>
          <TerminalCard bodyClassName="p-0">
            <div className="overflow-x-auto">
              <TerminalTable>
                <thead className="bg-secondary/25 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left">{t("portfolio.portfolio")}</th>
                    <th className="px-3 py-3 text-right">{t("portfolio.quantity")}</th>
                    <th className="px-3 py-3 text-right">{t("portfolio.averagePrice")}</th>
                    <th className="px-3 py-3 text-right">{t("portfolio.marketValue")}</th>
                    <th className="px-3 py-3 text-right">{t("portfolio.unrealized")}</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row) => (
                    <tr
                      key={row.portfolioId ?? "__unassigned__"}
                      className="border-t border-border/50 transition-colors hover:bg-secondary/20"
                    >
                      <td className="px-3 py-3">
                        {row.portfolioId
                          ? (portfolioMap.get(row.portfolioId) ?? "-")
                          : t("portfolio.unassigned")}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {fmt(row.quantity, { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {fmtCurrency(row.averagePrice, summary.currency)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {fmtCurrency(row.marketValue, summary.currency)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right tabular-nums ${
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
          <div className="flex justify-end border-b border-border/50 bg-secondary/20 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {holdingTransactions.length} {t("header.transactions")}
            </div>
          </div>
          <div className="overflow-x-auto">
            <TerminalTable>
              <thead className="bg-secondary/25 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-3 text-left">
                    <button
                      type="button"
                      onClick={() =>
                        setTxSortDirection((direction) => (direction === "asc" ? "desc" : "asc"))
                      }
                      className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-secondary/45 hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label={`${t("portfolio.date")}: ${
                        txSortDirection === "asc" ? "ascending" : "descending"
                      }`}
                    >
                      {t("portfolio.date")} {txSortDirection === "asc" ? "↑" : "↓"}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left">{t("portfolio.action")}</th>
                  <th className="px-3 py-3 text-left">{t("portfolio.portfolio")}</th>
                  <th className="px-3 py-3 text-right">{t("portfolio.quantity")}</th>
                  <th className="px-3 py-3 text-right">{t("portfolio.price")}</th>
                  <th className="px-3 py-3 text-right">{t("portfolio.fees")}</th>
                  <th className="px-3 py-3 text-right">{t("portfolio.total")}</th>
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
                        className="border-t border-border/50 transition-colors hover:bg-secondary/20"
                      >
                        <td className="px-3 py-3 tabular-nums">{transaction.transaction_date}</td>
                        <td className="px-3 py-3 uppercase">
                          {t(`portfolio.action${capitalizeAction(transaction.action ?? "buy")}`)}
                        </td>
                        <td className="px-3 py-3">
                          {transaction.portfolio_id
                            ? (portfolioMap.get(transaction.portfolio_id) ?? "-")
                            : t("portfolio.unassigned")}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {fmt(Number(transaction.shares), {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 4,
                          })}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {fmtCurrency(Number(transaction.price), transaction.currency)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {feeValue == null ? "-" : fmtCurrency(feeValue, transaction.currency)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
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
      <h2 className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
        <span className="text-primary">&gt;</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function HoldingDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-secondary/40" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[10px] bg-secondary/40" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-[10px] bg-secondary/40" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-[10px] bg-secondary/40" />
    </div>
  );
}

function HoldingDetailsMissing({ ticker }: { ticker: string }) {
  const { t } = useTranslation();

  return (
    <div className="analytics-panel rounded-[10px] bg-card/70 p-12 text-center shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
      <div className="text-xs uppercase tracking-[0.12em] text-primary">
        {t("portfolio.holdingNotFound")}
      </div>
      <h2 className="mt-3 text-2xl">{ticker}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("portfolio.noHoldingMatch")}</p>
      <Link
        to="/portfolio/holdings"
        className="mt-6 inline-block rounded-lg bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_10px_28px_-16px_var(--color-primary)] transition-all hover:-translate-y-0.5 hover:opacity-90"
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
