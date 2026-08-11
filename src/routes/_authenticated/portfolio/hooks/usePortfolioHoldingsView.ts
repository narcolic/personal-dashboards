import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch } from "@/lib/api/client";
import type { Enriched, HoldingRow } from "@/lib/portfolio/types";
import { listPortfolioHoldings } from "@/lib/portfolio/holdings/api";
import { usePortfolioData } from "@/routes/_authenticated/portfolio/hooks/usePortfolioData";
import { useQuotes } from "@/routes/_authenticated/portfolio/hooks/useQuotes";
import { useTransactionsFilters } from "@/routes/_authenticated/portfolio/hooks/useTransactionsFilters";

export type RowWithNative = Enriched & { _nativeCurrency: string };

const EMPTY_HOLDINGS: HoldingRow[] = [];

export function usePortfolioHoldingsView() {
  const { t } = useTranslation();
  const { txQ, portfoliosQ, transactions } = usePortfolioData();
  const holdingsQ = useQuery({
    queryKey: ["positions", "holdings"],
    queryFn: ({ signal }) => listPortfolioHoldings(signal),
  });
  const positions = holdingsQ.data ?? EMPTY_HOLDINGS;
  const { quotesQ, enrichedRows } = useQuotes(positions, {
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  const transactionCurrencies = useMemo(() => {
    const currencies = new Set<string>();
    for (const position of positions) {
      const currency = (position.currency || "").toUpperCase();
      if (currency) currencies.add(currency);
    }
    return currencies.size ? [...currencies].sort() : ["USD"];
  }, [positions]);

  const fxWanted = useMemo(
    () => Array.from(new Set(["USD", "EUR", ...transactionCurrencies])).sort(),
    [transactionCurrencies],
  );

  const fxQ = useQuery({
    queryKey: ["fx-rates", fxWanted.join(",")],
    queryFn: async () => {
      const wanted = Array.from(new Set(fxWanted.map((currency) => currency.toUpperCase())));
      const toUsdPerUnit = (allRates: Record<string, number>) => {
        const rates: Record<string, number> = { USD: 1 };
        for (const currency of wanted) {
          if (currency === "USD") continue;
          const usdToCurrency = Number(allRates[currency]);
          if (Number.isFinite(usdToCurrency) && usdToCurrency > 0) {
            rates[currency] = 1 / usdToCurrency;
          }
        }
        return rates;
      };

      try {
        const data = await apiFetch<{ rates?: Record<string, number> }>(
          "/api/portfolio/fx-rates?from=USD",
        );
        if (data.rates) return { rates: toUsdPerUnit(data.rates) };
      } catch (error) {
        void error;
      }

      return { rates: { USD: 1, EUR: 1 } };
    },
    staleTime: 10 * 60_000,
    gcTime: 24 * 60 * 60_000,
  });

  const rates = useMemo<Record<string, number>>(() => fxQ.data?.rates ?? { USD: 1 }, [fxQ.data]);

  const allRows = useMemo<RowWithNative[]>(
    () =>
      enrichedRows.map((row) => ({
        ...row,
        _nativeCurrency: (row.quote?.currency ?? row.currency ?? "USD").toUpperCase(),
      })),
    [enrichedRows],
  );

  const {
    selected,
    setSelected,
    display,
    setDisplay,
    rows,
    displayCurrencies,
    allId,
    unassignedId,
  } = useTransactionsFilters({ allRows, transactionCurrencies });

  const convertTo = useMemo(() => {
    return (amount: number, from: string, to: string) => {
      const source = (from || "USD").toUpperCase();
      const target = (to || "USD").toUpperCase();
      const fromRate = rates[source] ?? 1;
      const toRate = rates[target] ?? 1;
      if (!fromRate || !toRate) return amount;
      return (amount * fromRate) / toRate;
    };
  }, [rates]);

  const convert = useMemo(() => {
    return (amount: number, from: string) => {
      return convertTo(amount, from, display);
    };
  }, [convertTo, display]);

  const portfolioMap = useMemo(
    () => new Map((portfoliosQ.data ?? []).map((portfolio) => [portfolio.id, portfolio.name])),
    [portfoliosQ.data],
  );

  const portfolioTabs = useMemo(
    () => [
      { id: allId, label: t("portfolio.all") },
      ...Array.from(
        new Map(
          allRows.map((row) => [
            row.portfolio_id ?? unassignedId,
            row.portfolio_id
              ? (portfolioMap.get(row.portfolio_id) ?? "-")
              : t("portfolio.unassigned"),
          ]),
        ),
        ([id, label]) => ({ id, label: label.toUpperCase() }),
      ),
    ],
    [allId, allRows, portfolioMap, t, unassignedId],
  );

  return {
    txQ,
    holdingsQ,
    quotesQ,
    transactions,
    portfolios: portfoliosQ.data ?? [],
    allRows,
    rows,
    display,
    setDisplay,
    displayCurrencies,
    selected,
    setSelected,
    portfolioTabs,
    portfolioMap,
    convert,
    convertTo,
  };
}
