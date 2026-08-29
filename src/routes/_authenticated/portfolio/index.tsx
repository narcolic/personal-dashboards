import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TerminalCard } from "@/components/terminal/TerminalCard";
import { TerminalTable } from "@/components/terminal/TerminalTable";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import { fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import { PortfolioChart } from "@/routes/_authenticated/portfolio/components/PortfolioChart";
import { PortfolioHoldingsTable } from "@/routes/_authenticated/portfolio/components/PortfolioHoldingsTable";
import {
  type RowWithNative,
  usePortfolioHoldingsView,
} from "@/routes/_authenticated/portfolio/hooks/usePortfolioHoldingsView";

type AllocationKind = "assetType" | "region" | "currency";
type ConvFn = (amount: number, from: string) => number;

export const Route = createFileRoute("/_authenticated/portfolio/")({
  validateSearch: (search: Record<string, unknown>) => ({
    allocationKind:
      search.allocationKind === "assetType" ||
      search.allocationKind === "region" ||
      search.allocationKind === "currency"
        ? search.allocationKind
        : undefined,
    allocationValue:
      typeof search.allocationValue === "string" ? search.allocationValue : undefined,
  }),
  component: PortfolioPage,
});

function PortfolioPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const allocationSearch = Route.useSearch();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [assetTypeFilter, setAssetTypeFilter] = useState("__all__");
  const [currencyFilter, setCurrencyFilter] = useState("__all__");
  const [regionFilter, setRegionFilter] = useState("__all__");
  const [allocationKind, setAllocationKind] = useState<AllocationKind>("assetType");
  const { txQ, holdingsQ, quotesQ, transactions, rows, display, selected, portfolioMap, convert } =
    usePortfolioHoldingsView();

  const totals = useMemo(() => computeTotals(rows, convert), [convert, rows]);
  const rowRegions = useMemo(
    () =>
      new Map(
        rows.map((row) => [row.id, row.security?.effectiveGeography || t("portfolio.unknown")]),
      ),
    [rows, t],
  );
  const allocationData = useMemo(
    () => buildAllocationData(rows, allocationKind, rowRegions, convert, t("portfolio.unknown")),
    [allocationKind, convert, rowRegions, rows, t],
  );
  const assetTypeOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.asset_type).filter(Boolean))).sort(),
    [rows],
  );
  const currencyOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row._nativeCurrency).filter(Boolean))).sort(),
    [rows],
  );
  const regionOptions = useMemo(
    () => Array.from(new Set(rowRegions.values())).sort(),
    [rowRegions],
  );
  const activeAllocation = useMemo(
    () =>
      allocationSearch.allocationKind && allocationSearch.allocationValue
        ? {
            kind: allocationSearch.allocationKind,
            value: allocationSearch.allocationValue,
          }
        : null,
    [allocationSearch.allocationKind, allocationSearch.allocationValue],
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const region = rowRegions.get(row.id) ?? t("portfolio.unknown");
      const matchesQuery =
        !query ||
        row.ticker.toLowerCase().includes(query) ||
        (row.quote?.shortName || row.name || row.asset_type).toLowerCase().includes(query);
      const matchesAsset = assetTypeFilter === "__all__" || row.asset_type === assetTypeFilter;
      const matchesCurrency =
        currencyFilter === "__all__" || row._nativeCurrency === currencyFilter;
      const matchesRegion = regionFilter === "__all__" || region === regionFilter;
      const matchesAllocation =
        !activeAllocation ||
        (activeAllocation.kind === "assetType"
          ? row.asset_type === activeAllocation.value
          : activeAllocation.kind === "currency"
            ? row._nativeCurrency === activeAllocation.value
            : region === activeAllocation.value);
      return matchesQuery && matchesAsset && matchesCurrency && matchesRegion && matchesAllocation;
    });
  }, [
    activeAllocation,
    assetTypeFilter,
    currencyFilter,
    regionFilter,
    rowRegions,
    rows,
    search,
    t,
  ]);
  const recentTransactions = useMemo(
    () =>
      transactions
        .filter((transaction) => selected === "__all__" || transaction.portfolio_id === selected)
        .slice(0, 5),
    [selected, transactions],
  );
  const activeFilterCount =
    Number(assetTypeFilter !== "__all__") +
    Number(currencyFilter !== "__all__") +
    Number(regionFilter !== "__all__") +
    Number(Boolean(activeAllocation));

  if (txQ.isLoading || holdingsQ.isLoading || quotesQ.isLoading) return <PortfolioSkeleton />;
  if (transactions.length === 0) return <PortfolioEmptyState />;

  const clearFilters = () => {
    setSearch("");
    setAssetTypeFilter("__all__");
    setCurrencyFilter("__all__");
    setRegionFilter("__all__");
    void navigate({ to: "/portfolio", search: {} });
  };

  const applyAllocation = (value: string) => {
    void navigate({
      to: "/portfolio",
      search: { allocationKind, allocationValue: value },
    });
    window.requestAnimationFrame(() => {
      document.getElementById("holdings")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="portfolio-summary-heading" className="space-y-3">
        <SectionHeading id="portfolio-summary-heading">{t("portfolio.atAGlance")}</SectionHeading>
        <div className="analytics-panel overflow-hidden rounded-[10px] border border-border/70 bg-card/80 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
          <div className="grid grid-cols-2 md:grid-cols-[minmax(0,1.35fr)_minmax(220px,1fr)_minmax(220px,1fr)]">
            <PortfolioPulseMetric
              label={t("portfolio.totalValue")}
              value={fmtCurrency(totals.marketValue, display)}
              lead
            />
            <PortfolioPulseMetric
              label={t("portfolio.dayPnl")}
              value={formatSignedCurrency(totals.dayChange, display)}
              detail={`${formatDirection(totals.dayChange)} ${fmtPct(totals.dayPct)}`}
              tone={totals.dayChange >= 0 ? "bull" : "bear"}
            />
            <PortfolioPulseMetric
              label={t("portfolio.totalReturn")}
              value={formatSignedCurrency(totals.unrealized, display)}
              detail={`${formatDirection(totals.unrealized)} ${fmtPct(totals.unrealizedPct)}`}
              tone={totals.unrealized >= 0 ? "bull" : "bear"}
              right
            />
          </div>
        </div>
      </section>

      <section id="holdings" className="scroll-mt-28 space-y-3" aria-labelledby="holdings-heading">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading id="holdings-heading">{t("portfolio.holdings")}</SectionHeading>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="min-w-0 sm:w-72">
              <span className="sr-only">{t("portfolio.holdingsSearch")}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("portfolio.holdingsSearchPlaceholder")}
                className="h-10 w-full rounded-lg border border-border/70 bg-card/70 px-3 text-sm outline-none transition-colors hover:border-primary/60 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30"
              />
            </label>
            <button
              type="button"
              onClick={() => setShowFilters((visible) => !visible)}
              aria-expanded={showFilters}
              className={`h-10 rounded-lg border px-4 text-xs uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                showFilters || activeFilterCount
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 bg-card/70 text-muted-foreground hover:border-primary/60 hover:text-foreground"
              }`}
            >
              {t("portfolio.filters")} {activeFilterCount ? `(${activeFilterCount})` : ""}
            </button>
          </div>
        </div>

        {showFilters ? (
          <div className="analytics-panel grid grid-cols-1 gap-3 rounded-[10px] border border-border/70 bg-card/70 p-4 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] sm:grid-cols-3">
            <FilterSelect
              label={t("portfolio.assetType")}
              value={assetTypeFilter}
              options={assetTypeOptions}
              allLabel={t("portfolio.all")}
              onChange={setAssetTypeFilter}
            />
            <FilterSelect
              label={t("portfolio.currency")}
              value={currencyFilter}
              options={currencyOptions}
              allLabel={t("portfolio.all")}
              onChange={setCurrencyFilter}
            />
            <FilterSelect
              label={t("portfolio.region")}
              value={regionFilter}
              options={regionOptions}
              allLabel={t("portfolio.all")}
              onChange={setRegionFilter}
            />
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-primary"
              >
                {t("portfolio.clearFilters")}
              </button>
            </div>
          </div>
        ) : null}

        {activeAllocation ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t("portfolio.allocationFilter")}:</span>
            <button
              type="button"
              onClick={() => void navigate({ to: "/portfolio", search: {} })}
              className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary transition-colors hover:bg-primary/20"
            >
              {activeAllocation.value} ×
            </button>
          </div>
        ) : null}

        <PortfolioHoldingsTable
          rows={filteredRows}
          display={display}
          convert={convert}
          formatDisplayCurrency={(value) => fmtCurrency(value, display)}
          mode="holdings"
          totalCount={rows.length}
          title=""
          onRowClick={(row) =>
            void navigate({
              to: "/portfolio/holdings/$ticker",
              params: { ticker: row.ticker },
            })
          }
        />
      </section>

      <section className="space-y-3" aria-labelledby="allocation-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionHeading id="allocation-heading">
            {t("portfolio.allocationSection")}
          </SectionHeading>
          <div
            className="inline-flex self-start rounded-lg border border-border/70 bg-secondary/45 p-1"
            role="group"
          >
            {(["assetType", "region", "currency"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={allocationKind === kind}
                onClick={() => setAllocationKind(kind)}
                className={`rounded-md px-3 py-2 text-xs uppercase tracking-[0.1em] transition-colors ${
                  allocationKind === kind
                    ? "bg-card text-primary shadow-sm ring-1 ring-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`portfolio.allocation${capitalize(kind)}`)}
              </button>
            ))}
          </div>
        </div>
        <PortfolioChart
          title={t(`portfolio.allocationBy${capitalize(allocationKind)}`)}
          data={allocationData}
          total={totals.marketValue}
          chart={allocationKind === "region" ? "bar" : "pie"}
          display={display}
          onItemClick={applyAllocation}
          chartHeight={180}
          pieInnerRadius={44}
          pieOuterRadius={76}
        />
      </section>

      {recentTransactions.length > 0 ? (
        <section className="space-y-3" aria-labelledby="recent-activity-heading">
          <div className="flex items-center justify-between gap-3">
            <SectionHeading id="recent-activity-heading">
              {t("portfolio.recentActivity")}
            </SectionHeading>
            <Link
              to="/portfolio/activity"
              className="rounded-md px-2 py-1 text-xs uppercase tracking-[0.1em] text-primary transition-colors hover:bg-primary/10"
            >
              {t("portfolio.viewAllActivity")} →
            </Link>
          </div>
          <TerminalCard bodyClassName="p-0">
            <TerminalTable>
              <thead className="bg-secondary/40 text-xs uppercase tracking-[0.1em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">{t("portfolio.date")}</th>
                  <th className="px-3 py-2 text-left">{t("portfolio.ticker")}</th>
                  <th className="hidden px-3 py-2 text-left sm:table-cell">
                    {t("portfolio.portfolio")}
                  </th>
                  <th className="px-3 py-2 text-left">{t("portfolio.action")}</th>
                  <th className="px-3 py-2 text-right">{t("portfolio.total")}</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-t border-border/60 text-xs">
                    <td className="px-3 py-2 tabular-nums">{transaction.transaction_date}</td>
                    <td className="px-3 py-2 font-bold text-primary">{transaction.ticker}</td>
                    <td className="hidden px-3 py-2 sm:table-cell">
                      {transaction.portfolio_id
                        ? (portfolioMap.get(transaction.portfolio_id) ?? "—")
                        : t("portfolio.unassigned")}
                    </td>
                    <td className="px-3 py-2 uppercase">
                      {t(`portfolio.action${capitalize(transaction.action ?? "buy")}`)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmtCurrency(
                        Number(transaction.shares) * Number(transaction.price),
                        transaction.currency,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </TerminalTable>
          </TerminalCard>
        </section>
      ) : null}
    </div>
  );
}

function SectionHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground"
    >
      <span className="text-primary">&gt;</span>
      <span>{children}</span>
    </h2>
  );
}

function PortfolioPulseMetric({
  label,
  value,
  detail,
  tone,
  lead = false,
  right = false,
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "bull" | "bear";
  lead?: boolean;
  right?: boolean;
}) {
  const toneClass =
    tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-foreground";

  return (
    <div
      className={`relative text-center md:px-6 md:py-5 md:text-left ${
        lead
          ? "col-span-2 bg-primary/[0.035] px-5 py-6 md:col-span-1"
          : `border-t border-border/50 px-3 py-4 md:border-l md:border-t-0 ${right ? "border-l" : ""}`
      }`}
    >
      {lead ? (
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 h-0.5 w-12 -translate-x-1/2 rounded-b bg-primary md:inset-y-5 md:left-0 md:h-auto md:w-0.5 md:translate-x-0 md:rounded-r"
        />
      ) : null}
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:text-xs md:tracking-[0.14em]">
        {label}
      </div>
      <div
        className={`font-bold tracking-tight tabular-nums ${
          lead ? "mt-3 text-3xl md:text-[2.1rem]" : "mt-2 text-xl md:mt-3 md:text-2xl"
        } ${toneClass}`}
      >
        {value}
      </div>
      {detail ? (
        <div
          className={`mt-1.5 text-[10px] font-semibold tabular-nums md:mt-2 md:text-xs ${toneClass}`}
        >
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
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
        options={[
          { value: "__all__", label: allLabel },
          ...options.map((option) => ({ value: option, label: option })),
        ]}
      />
    </div>
  );
}

function computeTotals(rows: RowWithNative[], convert: ConvFn) {
  let marketValue = 0;
  let costBasis = 0;
  let dayChange = 0;
  for (const row of rows) {
    marketValue += convert(row.marketValue, row._nativeCurrency);
    costBasis += convert(row.costBasis, row._nativeCurrency);
    dayChange += convert(row.dayChange, row._nativeCurrency);
  }
  const unrealized = marketValue - costBasis;
  return {
    marketValue,
    costBasis,
    dayChange,
    unrealized,
    dayPct: marketValue - dayChange ? (dayChange / (marketValue - dayChange)) * 100 : 0,
    unrealizedPct: costBasis ? (unrealized / costBasis) * 100 : 0,
  };
}

function buildAllocationData(
  rows: RowWithNative[],
  kind: AllocationKind,
  regions: Map<string, string>,
  convert: ConvFn,
  unknown: string,
) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const name =
      kind === "assetType"
        ? row.asset_type
        : kind === "currency"
          ? row._nativeCurrency
          : (regions.get(row.id) ?? unknown);
    totals.set(name, (totals.get(name) ?? 0) + convert(row.marketValue, row._nativeCurrency));
  }
  return Array.from(totals, ([name, value]) => ({ name, value })).sort(
    (left, right) => right.value - left.value,
  );
}

function formatSignedCurrency(value: number, currency: string) {
  return `${value >= 0 ? "+" : "−"}${fmtCurrency(Math.abs(value), currency)}`;
}

function formatDirection(value: number) {
  return value >= 0 ? "▲" : "▼";
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-16 w-80 max-w-full animate-pulse rounded-[10px] bg-secondary/50" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-[10px] border border-border/70 bg-card"
          />
        ))}
      </div>
      <div className="h-[430px] animate-pulse rounded-[10px] border border-border/70 bg-card" />
    </div>
  );
}

function PortfolioEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="analytics-panel rounded-[10px] border border-dashed border-border bg-card/70 p-10 text-center shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] sm:p-14">
      <div className="text-xs uppercase tracking-[0.2em] text-primary">
        {t("portfolio.noTransactions")}
      </div>
      <h1 className="mt-3 text-2xl font-bold">{t("portfolio.emptyPortfolio")}</h1>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
        {t("portfolio.addFirstTransaction")}
      </p>
      <Link
        to="/portfolio/activity"
        search={{ add: true }}
        className="mt-6 inline-flex rounded-lg bg-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-[0_10px_28px_-16px_var(--color-primary)] transition-all hover:-translate-y-0.5 hover:opacity-90"
      >
        {t("portfolio.addTransactionAction")}
      </Link>
    </div>
  );
}
