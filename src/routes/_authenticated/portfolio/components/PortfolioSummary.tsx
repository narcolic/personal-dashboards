import { StatCard } from "@/components/terminal/StatCard";
import { fmtPct } from "@/lib/portfolio/formatters";
import { useTranslation } from "react-i18next";

type Totals = {
  mv: number;
  cost: number;
  dayChange: number;
  unrealized: number;
  dayPct: number;
  unrealizedPct: number;
};

export function PortfolioSummary({
  selectedAll,
  display,
  totals,
  formatCurrency,
  onUnrealizedClick,
}: {
  selectedAll: boolean;
  display: string;
  totals: Totals;
  formatCurrency: (value: number) => string;
  onUnrealizedClick?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={
          selectedAll ? t("portfolio.netWorth") : `${t("portfolio.portfolioValue")} (${display})`
        }
        value={formatCurrency(totals.mv)}
        accent
        size="featured"
      />
      <StatCard
        label={t("portfolio.dayPnl")}
        value={formatCurrency(totals.dayChange)}
        sub={fmtPct(totals.dayPct)}
        tone={totals.dayChange >= 0 ? "bull" : "bear"}
        size="featured"
      />
      <StatCard
        label={t("portfolio.unrealized")}
        value={formatCurrency(totals.unrealized)}
        sub={fmtPct(totals.unrealizedPct)}
        tone={totals.unrealized >= 0 ? "bull" : "bear"}
        onClick={onUnrealizedClick}
        size="featured"
      />
      <StatCard
        label={t("portfolio.costBasis")}
        value={formatCurrency(totals.cost)}
        size="featured"
      />
    </div>
  );
}
