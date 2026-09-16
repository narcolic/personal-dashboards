import { useTranslation } from "react-i18next";
import { fmtCurrency, fmtPct } from "@/lib/portfolio/formatters";

type SummaryValues = {
  totalValue: number;
  availableCash: number;
  dayChange: number;
  dayPct: number;
  unrealized: number;
  unrealizedPct: number;
  realized: number;
  currency: string;
};

function gainTone(value: number) {
  return value > 0 ? "text-bull" : value < 0 ? "text-bear" : "text-muted-foreground";
}

function signedCurrency(value: number, currency: string) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${fmtCurrency(Math.abs(value), currency)}`;
}

export function PortfolioSummary(values: SummaryValues) {
  const { t } = useTranslation();
  const zeroAmount = fmtCurrency(0, values.currency);
  const showCash = fmtCurrency(Math.abs(values.availableCash), values.currency) !== zeroAmount;
  const showRealized = fmtCurrency(Math.abs(values.realized), values.currency) !== zeroAmount;
  const metricCount = 1 + Number(showCash) + Number(showRealized);
  const desktopColumns =
    metricCount === 3 ? "sm:grid-cols-3" : metricCount === 2 ? "sm:grid-cols-2" : "sm:grid-cols-1";
  return (
    <div className="portfolio-summary overflow-hidden rounded-[20px] border border-border/45 bg-card/70 bg-[radial-gradient(ellipse_at_top_left,var(--summary-glow),transparent_65%)] p-5 font-analytics shadow-[0_16px_48px_-36px_rgba(0,0,0,0.35)] [--summary-glow:color-mix(in_oklab,var(--color-primary)_5%,transparent)] sm:p-7 lg:flex lg:items-center lg:gap-10">
      <div className="min-w-0 lg:w-[36%] lg:shrink-0">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-primary" />
          {t("portfolio.summary.totalValue")}
        </div>
        <div className="mt-2 break-words text-[36px] font-semibold leading-[1.15] tracking-[-0.045em] text-foreground tabular-nums [overflow-wrap:anywhere] sm:text-[44px]">
          {fmtCurrency(values.totalValue, values.currency)}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm tabular-nums">
          <span className={`text-base font-medium ${gainTone(values.dayChange)}`}>
            {signedCurrency(values.dayChange, values.currency)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${values.dayPct > 0 ? "bg-bull/10 text-bull" : values.dayPct < 0 ? "bg-bear/10 text-bear" : "bg-secondary/60 text-muted-foreground"}`}
          >
            {fmtPct(values.dayPct)}
          </span>
          <span className="text-xs text-muted-foreground">{t("portfolio.summary.dayChange")}</span>
        </div>
      </div>
      <dl
        className={`mt-6 grid min-w-0 flex-1 ${showRealized ? "grid-cols-2" : "grid-cols-1"} gap-x-5 gap-y-5 border-t border-border/50 pt-5 ${desktopColumns} sm:grid-rows-[auto_auto_auto] sm:gap-y-2 lg:mt-0 lg:gap-x-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0`}
      >
        {showCash ? (
          <div className="col-span-full flex min-w-0 flex-wrap items-baseline justify-between gap-2 border-b border-border/40 pb-4 sm:col-span-1 sm:row-span-3 sm:grid sm:grid-rows-subgrid sm:border-0 sm:pb-0">
            <dt className="min-w-0 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              {t("portfolio.summary.availableCash")}
            </dt>
            <dd className="min-w-0 break-words text-[22px] font-medium leading-tight tracking-tight text-foreground tabular-nums [overflow-wrap:anywhere] sm:mt-0 sm:text-[26px]">
              {fmtCurrency(values.availableCash, values.currency)}
            </dd>
          </div>
        ) : null}
        <div className="min-w-0 sm:row-span-3 sm:grid sm:grid-rows-subgrid">
          <dt className="text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
            {t("portfolio.summary.unrealized")}
          </dt>
          <dd
            className={`mt-3 break-words text-[22px] font-medium leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere] sm:mt-0 sm:text-[26px] ${values.unrealized === 0 ? "text-foreground" : gainTone(values.unrealized)}`}
          >
            {signedCurrency(values.unrealized, values.currency)}
          </dd>
          <dd
            className={`mt-1.5 text-xs font-medium tabular-nums sm:mt-0 ${gainTone(values.unrealizedPct)}`}
          >
            {fmtPct(values.unrealizedPct)}
          </dd>
        </div>
        {showRealized ? (
          <div className="min-w-0 sm:row-span-3 sm:grid sm:grid-rows-subgrid">
            <dt className="text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">
              {t("portfolio.summary.realized")}
            </dt>
            <dd
              className={`mt-3 break-words text-[22px] font-medium leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere] sm:mt-0 sm:text-[26px] ${values.realized === 0 ? "text-foreground" : gainTone(values.realized)}`}
            >
              {signedCurrency(values.realized, values.currency)}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
