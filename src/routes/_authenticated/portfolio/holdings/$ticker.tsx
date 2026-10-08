import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { TerminalTable } from "@/components/terminal/TerminalTable";
import { fmt, fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import { createPortfolio } from "@/lib/portfolio/portfolios/api";
import { portfolioQueryKeys } from "@/lib/portfolio/queries";
import { invalidatePortfolioData } from "@/lib/portfolio/queries";
import { createTransaction, type TransactionInputType } from "@/lib/portfolio/transactions/api";
import { TransactionEditor } from "@/routes/_authenticated/portfolio/components/TransactionEditor";
import { usePortfolioHoldingsView } from "@/routes/_authenticated/portfolio/hooks/usePortfolioHoldingsView";
import { useTickerCatalog } from "@/routes/_authenticated/portfolio/hooks/useTickerCatalog";
import { usePortfolioColors } from "@/routes/_authenticated/portfolio/hooks/usePortfolioColors";

export const Route = createFileRoute("/_authenticated/portfolio/holdings/$ticker")({
  component: HoldingDetailsPage,
});

function HoldingDetailsPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { ticker } = Route.useParams();
  const normalizedTicker = ticker.trim().toUpperCase();
  const [editing, setEditing] = useState<(TransactionInputType & { id?: string }) | null>(null);
  const [txSortDirection, setTxSortDirection] = useState<"asc" | "desc">("desc");
  const {
    txQ,
    holdingsQ,
    quotesQ,
    cashQ,
    transactions,
    portfolios,
    allRows,
    portfolioMap,
    convertTo,
  } = usePortfolioHoldingsView();
  const { tickerCatalog } = useTickerCatalog();
  const { portfolioColors } = usePortfolioColors();

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

  const showTransactionPortfolio =
    new Set(holdingTransactions.map((row) => row.portfolio_id)).size > 1;
  const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

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
      securityListingId: first?.security_listing_id ?? null,
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
  const holdingPortfolios = useMemo(
    () =>
      breakdownRows.map((row) => ({
        id: row.portfolioId ?? "__unassigned__",
        name: row.portfolioId
          ? (portfolioMap.get(row.portfolioId) ?? "-")
          : t("portfolio.unassigned"),
      })),
    [breakdownRows, portfolioMap, t],
  );

  const tickerSuggestions = useMemo(() => {
    const map = new Map<
      string,
      {
        ticker: string;
        name: string | null;
        asset_type: string | null;
        market: string | null;
        currency: string | null;
        security_listing_id: string;
      }
    >();

    for (const row of tickerCatalog) {
      if (!row.security) {
        throw new Error(`Canonical security metadata is missing for catalog row ${row.id}.`);
      }
      const key = row.security.symbol.trim().toUpperCase();
      if (!key) continue;
      map.set(key, {
        ticker: key,
        name: row.security.name,
        asset_type: row.security.securityType,
        market: row.security.exchangeName ?? row.security.exchangeMic,
        currency: row.security.tradingCurrency,
        security_listing_id: row.security.listingId,
      });
    }

    for (const row of holdingRows) {
      if (!row.security) {
        throw new Error(`Canonical security metadata is missing for holding ${row.id}.`);
      }
      const key = row.security.symbol.trim().toUpperCase();
      map.set(key, {
        ticker: key,
        name: row.security.name,
        asset_type: row.security.securityType,
        market: row.security.exchangeName ?? row.security.exchangeMic,
        currency: row._nativeCurrency ?? null,
        security_listing_id: row.security.listingId,
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
    <div className="space-y-6 font-analytics">
      <Link
        to="/portfolio"
        hash="holdings"
        className="inline-flex rounded-md px-2 py-1 text-xs uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:bg-secondary/35 hover:text-primary"
      >
        ← {t("header.portfolio")} / {t("portfolio.holdings")}
      </Link>
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/70">
        <header className="flex flex-wrap items-start justify-between gap-5 p-5 md:p-6">
          <div className="min-w-0 space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {summary.ticker}
            </h1>
            <p className="text-sm text-muted-foreground">{summary.companyName}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] font-semibold tracking-wide">
              <span className="rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-primary">
                {summary.assetType.toUpperCase()}
              </span>
              <span className="rounded-md border border-border bg-secondary/60 px-2.5 py-1 text-foreground/85">
                {summary.currency}
              </span>
              {holdingPortfolios.map(({ id, name }) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/30 px-2.5 py-1 text-foreground/85"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: portfolioColors.get(id) ?? "var(--color-muted-foreground)",
                    }}
                  />
                  {name}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditing(addTransactionDraft)}
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t("portfolio.addTransactionAction")}
          </button>
        </header>
        <div className="grid border-t border-border/50 sm:grid-cols-3">
          <HoldingMetric
            label={t("portfolio.summary.totalValue")}
            value={fmtCurrency(summary.marketValue, summary.currency)}
            featured
          />
          <HoldingMetric
            label={t("portfolio.summary.dayChange")}
            value={fmtCurrency(summary.dailyChange, summary.currency)}
            sub={fmtPct(summary.dailyChangePct)}
            tone={summary.dailyChange >= 0 ? "bull" : "bear"}
            featured
          />
          <HoldingMetric
            label={t("portfolio.summary.unrealized")}
            value={fmtCurrency(summary.unrealized, summary.currency)}
            sub={fmtPct(summary.unrealizedPct)}
            tone={summary.unrealized >= 0 ? "bull" : "bear"}
            featured
          />
        </div>
      </section>

      <HoldingSection title={t("portfolio.positionDetailsSection")}>
        <TerminalCard className="rounded-2xl bg-none shadow-none" bodyClassName="p-0">
          <div className="grid grid-cols-2 gap-y-1 md:grid-cols-3 xl:grid-cols-5">
            <HoldingMetric
              label={t("portfolio.quantityHeld")}
              value={fmt(summary.quantityHeld, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 4,
              })}
            />
            <HoldingMetric
              label={t("portfolio.averagePrice")}
              value={fmtCurrency(summary.averagePrice, summary.currency)}
            />
            <HoldingMetric
              label={t("portfolio.currentPrice")}
              value={fmtCurrency(summary.currentPrice, summary.currency)}
            />
            <HoldingMetric
              label={t("portfolio.costBasis").toLocaleLowerCase(
                i18n.resolvedLanguage ?? i18n.language,
              )}
              value={fmtCurrency(summary.costBasis, summary.currency)}
            />
            <HoldingMetric
              label={t("portfolio.analytics.allocation")}
              value={`${fmt(summary.allocationPct, { maximumFractionDigits: 2 })}%`}
            />
          </div>
        </TerminalCard>
      </HoldingSection>

      {showPortfolioBreakdown ? (
        <HoldingSection title={t("portfolio.portfolioBreakdown")}>
          <TerminalCard className="rounded-2xl bg-none shadow-none" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <TerminalTable>
                <thead className="bg-secondary/20 text-xs font-medium text-muted-foreground [&_th]:font-medium">
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

      <HoldingSection title={t("portfolio.transactionsSection")} count={holdingTransactions.length}>
        <TerminalCard className="rounded-2xl bg-none shadow-none" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <TerminalTable>
              <thead className="bg-secondary/20 text-xs font-medium text-muted-foreground [&_th]:font-medium">
                <tr>
                  <th
                    className="px-3 py-3 text-left"
                    aria-sort={txSortDirection === "asc" ? "ascending" : "descending"}
                  >
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
                  {showTransactionPortfolio && (
                    <th className="px-3 py-3 text-left">{t("portfolio.portfolio")}</th>
                  )}
                  <th className="px-3 py-3 text-right">{t("portfolio.quantity")}</th>
                  <th className="px-3 py-3 text-right">{t("portfolio.price")}</th>
                  <th className="px-3 py-3 text-right">{t("portfolio.fees")}</th>
                  <th className="px-3 py-3 text-right">{t("portfolio.total")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={showTransactionPortfolio ? 7 : 6}
                      className="px-3 py-6 text-center text-sm text-muted-foreground"
                    >
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
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                          {dateFormatter.format(
                            new Date(`${transaction.transaction_date}T12:00:00`),
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${transaction.action === "sell" ? "bg-bear/10 text-bear" : transaction.action === "buy" ? "bg-bull/10 text-bull" : "bg-secondary/50 text-muted-foreground"}`}
                          >
                            {t(`portfolio.action${capitalizeAction(transaction.action ?? "buy")}`)}
                          </span>
                        </td>
                        {showTransactionPortfolio && (
                          <td className="px-3 py-3">
                            {transaction.portfolio_id
                              ? (portfolioMap.get(transaction.portfolio_id) ?? "-")
                              : t("portfolio.unassigned")}
                          </td>
                        )}
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
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
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
          cashBalances={cashQ.data ?? []}
          busy={createM.isPending}
          error={createM.error?.message}
          onCreatePortfolio={async (name) => {
            const result = await createPortfolio({ name });
            await qc.invalidateQueries({ queryKey: portfolioQueryKeys.portfolios });
            invalidatePortfolioData(qc);
            return result.id;
          }}
          onClose={() => setEditing(null)}
          onSave={(value) => createM.mutate(value)}
        />
      ) : null}
    </div>
  );
}

function HoldingMetric({
  label,
  value,
  sub,
  tone,
  featured = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "bull" | "bear";
  featured?: boolean;
}) {
  const color = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-foreground";
  return (
    <dl className="min-w-0 px-4 py-4 md:px-5 md:py-5">
      <dt className="text-xs text-muted-foreground first-letter:uppercase">{label}</dt>
      <dd
        className={`mt-2 break-words font-semibold tracking-tight tabular-nums ${featured ? "text-2xl lg:text-3xl" : "text-xl"} ${color}`}
      >
        {value}
      </dd>
      {sub && <dd className={`mt-1 text-xs font-medium tabular-nums ${color}`}>{sub}</dd>}
    </dl>
  );
}

function HoldingSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {title}
        {count !== undefined && (
          <span className="rounded-md bg-secondary/50 px-2 py-0.5 text-xs font-normal tabular-nums text-muted-foreground">
            {count}
          </span>
        )}
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
    securityListingId: string | null;
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
    security_listing_id: summary.securityListingId,
    use_available_cash: false,
    fee_amount: 0,
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
