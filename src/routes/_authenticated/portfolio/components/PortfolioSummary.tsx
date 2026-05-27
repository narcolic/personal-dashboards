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
}: {
  selectedAll: boolean;
  display: string;
  totals: Totals;
  formatCurrency: (value: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label={selectedAll ? `${t("portfolio.netWorth")} (${display})` : `${t("portfolio.portfolioValue")} (${display})`}
        value={formatCurrency(totals.mv)}
        accent
      />
      <StatCard
        label={t("portfolio.dayPnl")}
        value={formatCurrency(totals.dayChange)}
        sub={fmtPct(totals.dayPct)}
        tone={totals.dayChange >= 0 ? "bull" : "bear"}
      />
      <StatCard
        label={t("portfolio.unrealized")}
        value={formatCurrency(totals.unrealized)}
        sub={fmtPct(totals.unrealizedPct)}
        tone={totals.unrealized >= 0 ? "bull" : "bear"}
      />
      <StatCard label={t("portfolio.costBasis")} value={formatCurrency(totals.cost)} />
    </div>
  );
}
