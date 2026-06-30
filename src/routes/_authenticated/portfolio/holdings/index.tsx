import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { StatCard } from "@/components/terminal/StatCard";
import { fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";
import { classifyHolding } from "@/lib/portfolio/transactions/mappers";
import { PortfolioHoldingsTable } from "@/routes/_authenticated/portfolio/components/PortfolioHoldingsTable";
import { usePortfolioHoldingsView } from "@/routes/_authenticated/portfolio/hooks/usePortfolioHoldingsView";

export const Route = createFileRoute("/_authenticated/portfolio/holdings")({
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
  component: Holdings,
});

function Holdings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const allocationSearch = Route.useSearch();
  const [search, setSearch] = useState("");
  const [assetTypeFilter, setAssetTypeFilter] = useState("__all__");
  const [currencyFilter, setCurrencyFilter] = useState("__all__");
  const {
    txQ,
    transactions,
    rows,
    display,
    setDisplay,
    displayCurrencies,
    selected,
    setSelected,
    portfolioTabs,
    convert,
  } = usePortfolioHoldingsView();
  const rowRegions = useMemo(
    () => new Map(rows.map((row) => [row.id, classifyHolding(row).regionCategory])),
    [rows],
  );
  const activeAllocationFilter =
    allocationSearch.allocationKind && allocationSearch.allocationValue
      ? {
          kind: allocationSearch.allocationKind,
          value: allocationSearch.allocationValue,
        }
      : null;
  const allocationKindLabel = activeAllocationFilter
    ? activeAllocationFilter.kind === "assetType"
      ? t("portfolio.assetType")
      : activeAllocationFilter.kind === "currency"
        ? t("portfolio.currency")
        : t("portfolio.region")
    : "";

  const assetTypeOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.asset_type).filter(Boolean))).sort(),
    [rows],
  );
  const currencyOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row._nativeCurrency).filter(Boolean))).sort(),
    [rows],
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        query.length === 0 ||
        row.ticker.toLowerCase().includes(query) ||
        (row.quote?.shortName || row.name || row.asset_type).toLowerCase().includes(query);
      const matchesAssetType = assetTypeFilter === "__all__" || row.asset_type === assetTypeFilter;
      const matchesCurrency =
        currencyFilter === "__all__" || row._nativeCurrency === currencyFilter;
      const matchesAllocation =
        !activeAllocationFilter ||
        (activeAllocationFilter.kind === "assetType"
          ? row.asset_type === activeAllocationFilter.value
          : activeAllocationFilter.kind === "currency"
            ? row._nativeCurrency === activeAllocationFilter.value
            : (rowRegions.get(row.id) ?? t("portfolio.unknown")) === activeAllocationFilter.value);
      return matchesSearch && matchesAssetType && matchesCurrency && matchesAllocation;
    });
  }, [activeAllocationFilter, assetTypeFilter, currencyFilter, rowRegions, rows, search, t]);
  const holdingsSummary = useMemo(() => {
    const totalHoldings = filteredRows.length;
    const totalMarketValue = filteredRows.reduce(
      (sum, row) => sum + convert(row.marketValue, row._nativeCurrency),
      0,
    );
    const largestPosition =
      filteredRows.reduce<(typeof filteredRows)[number] | null>((largest, row) => {
        if (!largest) return row;
        return convert(row.marketValue, row._nativeCurrency) >
          convert(largest.marketValue, largest._nativeCurrency)
          ? row
          : largest;
      }, null) ?? null;
    const averageGainPct =
      totalHoldings > 0
        ? filteredRows.reduce((sum, row) => sum + row.unrealizedPct, 0) / totalHoldings
        : 0;

    return {
      totalHoldings,
      totalMarketValue,
      largestPosition,
      averageGainPct,
    };
  }, [convert, filteredRows]);

  if (txQ.isLoading) return <HoldingsSkeleton />;
  if (transactions.length === 0) return <HoldingsEmptyState />;

  const goToHoldingDetails = (ticker: string) => {
    navigate({ to: "/portfolio/holdings/$ticker", params: { ticker } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl uppercase tracking-[0.2em]">{`> ${t("portfolio.holdings")}`}</h1>
      </div>

      <div className="border border-border bg-card/50 p-3">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            {t("portfolio.filters")}
          </div>
          <div className="flex items-center justify-between gap-3 md:justify-end">
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSelected(portfolioTabs[0]?.id ?? selected);
                setAssetTypeFilter("__all__");
                setCurrencyFilter("__all__");
                navigate({ to: "/portfolio/holdings", search: {} });
              }}
              className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary"
            >
              {t("portfolio.clearFilters")}
            </button>
            <div className="flex shrink-0 border border-border">
              {displayCurrencies.map((currency) => (
                <button
                  key={currency}
                  onClick={() => setDisplay(currency)}
                  className={`px-3 py-1 text-[10px] uppercase tracking-[0.2em] border-r border-border last:border-r-0 ${
                    display === currency
                      ? "bg-primary text-primary-foreground font-bold"
                      : "hover:text-primary"
                  }`}
                >
                  {currency}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("portfolio.holdingsSearch")}
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("portfolio.holdingsSearchPlaceholder")}
              className="w-full border border-border bg-input px-2 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("portfolio.portfolio")}
            </span>
            <select
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
              className="w-full border border-border bg-input px-2 py-2 text-sm focus:border-primary focus:outline-none"
            >
              {portfolioTabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("portfolio.assetType")}
            </span>
            <select
              value={assetTypeFilter}
              onChange={(event) => setAssetTypeFilter(event.target.value)}
              className="w-full border border-border bg-input px-2 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="__all__">{t("portfolio.all")}</option>
              {assetTypeOptions.map((assetType) => (
                <option key={assetType} value={assetType}>
                  {assetType}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("portfolio.currency")}
            </span>
            <select
              value={currencyFilter}
              onChange={(event) => setCurrencyFilter(event.target.value)}
              className="w-full border border-border bg-input px-2 py-2 text-sm uppercase focus:border-primary focus:outline-none"
            >
              <option value="__all__">{t("portfolio.all")}</option>
              {currencyOptions.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {activeAllocationFilter ? (
        <div className="flex items-center justify-between gap-3 border border-border bg-card px-3 py-2 text-[11px] uppercase tracking-[0.2em]">
          <div className="text-muted-foreground">
            {t("portfolio.allocationFilter")}:{" "}
            <span className="text-foreground">
              {allocationKindLabel} / {activeAllocationFilter.value}
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/portfolio/holdings", search: {} })}
            className="text-[10px] text-muted-foreground hover:text-primary"
          >
            {t("portfolio.clearFilters")}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label={t("portfolio.totalHoldings")}
          value={String(holdingsSummary.totalHoldings)}
        />
        <StatCard
          label={t("portfolio.largestPosition")}
          value={holdingsSummary.largestPosition?.ticker ?? "-"}
          sub={
            holdingsSummary.largestPosition
              ? fmtCurrency(
                  convert(
                    holdingsSummary.largestPosition.marketValue,
                    holdingsSummary.largestPosition._nativeCurrency,
                  ),
                  display,
                )
              : "-"
          }
        />
        <StatCard
          label={t("portfolio.averageGainPct")}
          value={fmtPct(holdingsSummary.averageGainPct)}
          tone={holdingsSummary.averageGainPct >= 0 ? "bull" : "bear"}
        />
        <StatCard
          label={t("portfolio.totalMarketValue")}
          value={fmtCurrency(holdingsSummary.totalMarketValue, display)}
          accent
        />
      </div>

      <PortfolioHoldingsTable
        rows={filteredRows}
        display={display}
        convert={convert}
        formatDisplayCurrency={(value) => fmtCurrency(value, display)}
        mode="holdings"
        totalCount={rows.length}
        onRowClick={(row) => goToHoldingDetails(row.ticker)}
      />
    </div>
  );
}

function HoldingsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 border border-border bg-card animate-pulse" />
      <div className="h-12 border border-border bg-card animate-pulse" />
      <div className="h-[420px] border border-border bg-card animate-pulse" />
    </div>
  );
}

function HoldingsEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="border border-dashed border-border p-12 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] text-primary">
        {t("portfolio.noTransactions")}
      </div>
      <h2 className="mt-3 text-2xl">{t("portfolio.emptyPortfolio")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("portfolio.addFirstTransaction")}</p>
      <Link
        to="/portfolio/transactions"
        className="inline-block mt-6 bg-primary text-primary-foreground px-6 py-2 text-xs uppercase tracking-[0.25em] font-bold hover:opacity-90"
      >
        {t("portfolio.addTransaction")}
      </Link>
    </div>
  );
}
