import { useTranslation } from "react-i18next";
import { calculatePortfolioFees } from "@/lib/portfolio/fees";
import { localDateKey } from "@/lib/portfolio/contributions/calculations";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import { useActivity } from "@/routes/_authenticated/portfolio/hooks/useActivity";
import { useContributionFx } from "@/routes/_authenticated/portfolio/hooks/useContributionFx";
export function PortfolioFees({
  portfolioId,
  currency,
}: {
  portfolioId: string;
  currency: string;
}) {
  const { t } = useTranslation();
  const activityQ = useActivity({});
  const fxQ = useContributionFx();
  const model = calculatePortfolioFees(
    activityQ.data?.rows ?? [],
    portfolioId,
    currency,
    fxQ.isError ? {} : (fxQ.data?.rates ?? {}),
    localDateKey(new Date()),
  );
  const loading = activityQ.isPending || (model.missingRates && fxQ.isPending);
  const unavailable = activityQ.isError || model.missingRates;
  return (
    <section
      className="rounded-[10px] border border-border/70 bg-card/70 px-5 py-4 font-analytics"
      aria-labelledby="portfolio-fees-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="portfolio-fees-title" className="text-sm font-medium text-muted-foreground">
            {t("portfolio.feesSummary.title")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("portfolio.feesSummary.scope")}</p>
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {loading ? "�" : unavailable ? "�" : fmtCurrency(model.total, currency)}
        </p>
      </div>
      {unavailable && !loading ? (
        <p className="mt-2 text-xs text-destructive">{t("portfolio.feesSummary.unavailable")}</p>
      ) : null}
    </section>
  );
}
