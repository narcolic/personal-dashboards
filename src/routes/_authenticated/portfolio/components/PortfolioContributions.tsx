import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import {
  buildContributionModel,
  getContributionYears,
  localDateKey,
  resolveContributionYear,
  type ContributionMonth,
} from "@/lib/portfolio/contributions/calculations";
import { fmtCurrency } from "@/lib/portfolio/formatters";
import { useActivity } from "@/routes/_authenticated/portfolio/hooks/useActivity";
import { useContributionFx } from "@/routes/_authenticated/portfolio/hooks/useContributionFx";

const EMPTY_ACTIVITY: never[] = [];
const EMPTY_RATES: Record<string, number> = {};
const COLORS = [
  "var(--color-primary)",
  "var(--color-chart-5)",
  "var(--color-bull)",
  "var(--color-amber)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-bear)",
];

type Series = { id: string; name: string; color: string };

export function PortfolioContributions({
  requestedYear,
  onYearChange,
  portfolioId,
  currency,
  portfolioMap,
}: {
  requestedYear?: number;
  onYearChange: (year: number) => void;
  portfolioId: string;
  currency: string;
  portfolioMap: ReadonlyMap<string, string>;
}) {
  const { t, i18n } = useTranslation();
  const activityQ = useActivity({});
  const fxQ = useContributionFx();
  const activity = activityQ.data?.rows ?? EMPTY_ACTIVITY;
  const rates = fxQ.isError ? EMPTY_RATES : (fxQ.data?.rates ?? EMPTY_RATES);
  const [today, setToday] = useState(() => localDateKey(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDateKey(new Date())), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const now = useMemo(() => new Date(`${today}T00:00:00`), [today]);
  const years = useMemo(() => getContributionYears(activity, now), [activity, now]);
  const year = resolveContributionYear(requestedYear, years);
  const model = useMemo(
    () => buildContributionModel(activity, { year, portfolioId, currency, rates, now }),
    [activity, year, portfolioId, currency, rates, now],
  );
  useEffect(() => {
    if (activityQ.isSuccess && requestedYear !== undefined && requestedYear !== year) {
      onYearChange(year);
    }
  }, [activityQ.isSuccess, requestedYear, year, onYearChange]);

  const series = useMemo(() => {
    // Keep colors stable across year and scope changes, including sold-out portfolios.
    const ids = [...new Set(activity.map((row) => row.portfolio_id ?? "__unassigned__"))].sort();
    const activeIds = new Set(model.months.flatMap((month) => Object.keys(month.byPortfolio)));
    return ids.flatMap<Series>((id, index) =>
      activeIds.has(id)
        ? [
            {
              id,
              name:
                id === "__unassigned__"
                  ? t("portfolio.unassigned")
                  : (portfolioMap.get(id) ?? t("portfolio.unknown")),
              color: COLORS[index % COLORS.length],
            },
          ]
        : [],
    );
  }, [activity, model.months, portfolioMap, t]);

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const hasMissingRates = model.missingCurrencies.length > 0;
  const loading = activityQ.isPending || (hasMissingRates && fxQ.isPending);
  const ready = !loading && !activityQ.isError && !hasMissingRates;
  const scopeLabel =
    portfolioId === "__all__"
      ? t("portfolio.all")
      : portfolioId === "__unassigned__"
        ? t("portfolio.unassigned")
        : (portfolioMap.get(portfolioId) ?? t("portfolio.unknown"));

  return (
    <section
      id="contributions"
      aria-labelledby="contributions-heading"
      className="scroll-mt-28 space-y-3"
    >
      <div className="analytics-panel overflow-hidden rounded-[10px] border border-border/70 bg-card shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
        <header className="space-y-4 px-4 pt-4 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="contributions-heading"
              className="flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-muted-foreground"
            >
              <span className="text-primary">&gt;</span>
              {t("portfolio.contributions.title")}
            </h2>
            <TerminalSelect
              value={String(year)}
              options={years.map((value) => ({ value: String(value), label: String(value) }))}
              onChange={(value) => onYearChange(Number(value))}
              ariaLabel={t("portfolio.contributions.year")}
              size="sm"
              className="w-24 shrink-0"
              disabled={activityQ.isPending || activityQ.isError}
            />
          </div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <ContributionStat
              label={t("portfolio.contributions.freshMoney")}
              value={ready ? fmtCurrency(model.total, currency) : "—"}
              primary
            />
            <ContributionStat
              label={t("portfolio.contributions.monthlyAverage")}
              value={ready ? fmtCurrency(model.monthlyAverage, currency) : "—"}
            />
            {ready && model.withdrawals > 0 ? (
              <ContributionStat
                label={t("portfolio.contributions.withdrawals")}
                value={fmtCurrency(model.withdrawals, currency)}
              />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {scopeLabel} · {year} · {t("portfolio.contributions.currentRates")}
          </p>
        </header>

        {loading ? (
          <div
            role="status"
            className="grid h-[280px] place-items-center text-sm text-muted-foreground"
          >
            {t("common.loading")}
          </div>
        ) : activityQ.isError || hasMissingRates ? (
          <div
            role="status"
            className="flex min-h-[280px] flex-col items-center justify-center gap-3 px-5 text-center text-sm text-muted-foreground"
          >
            <p>
              {t(
                activityQ.isError
                  ? "portfolio.contributions.loadError"
                  : "portfolio.contributions.conversionUnavailable",
              )}
            </p>
            <button
              type="button"
              onClick={() => void (activityQ.isError ? activityQ.refetch() : fxQ.refetch())}
              className="rounded-md px-3 py-2 text-xs uppercase tracking-[0.1em] text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {t("portfolio.contributions.retry")}
            </button>
          </div>
        ) : (
          <>
            {model.total === 0 ? (
              <p className="px-4 pt-4 text-xs text-muted-foreground md:px-5">
                {t("portfolio.contributions.empty")}
              </p>
            ) : null}
            <div
              className="h-[260px] w-full px-1 pt-4 md:h-[300px] md:px-3"
              role="img"
              aria-label={t("portfolio.contributions.chartLabel", {
                year,
                total: fmtCurrency(model.total, currency),
              })}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={model.months}
                  margin={{ top: 8, right: 0, left: 0, bottom: 8 }}
                  barCategoryGap="28%"
                  accessibilityLayer
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                    strokeOpacity={0.4}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="month"
                    interval={0}
                    axisLine={false}
                    tickLine={false}
                    height={32}
                    tick={
                      <ContributionMonthTick months={model.months} year={year} locale={locale} />
                    }
                  />
                  <YAxis
                    width={32}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                    tickFormatter={(value: number) =>
                      new Intl.NumberFormat(locale, {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(value)
                    }
                    domain={[0, (maximum: number) => Math.max(maximum, 1)]}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-secondary)", fillOpacity: 0.3 }}
                    content={
                      <ContributionTooltip
                        series={series}
                        currency={currency}
                        year={year}
                        locale={locale}
                      />
                    }
                  />
                  {series.map((item) => (
                    <Bar
                      key={item.id}
                      name={item.name}
                      dataKey={(month: ContributionMonth) => month.byPortfolio[item.id] ?? 0}
                      stackId="contributions"
                      fill={item.color}
                      radius={[2, 2, 0, 0]}
                      isAnimationActive={false}
                    >
                      {model.months.map((month) => (
                        <Cell
                          key={month.month}
                          fillOpacity={month.state === "current" ? 1 : 0.85}
                        />
                      ))}
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3 px-4 pb-4 md:px-5">
              {portfolioId === "__all__" && series.length > 0 ? (
                <ul
                  aria-label={t("portfolio.contributions.portfolioBreakdown")}
                  className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"
                >
                  {series.map((item) => (
                    <li key={item.id} className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: item.color }}
                      />
                      <span className="break-words">{item.name}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t("portfolio.contributions.definition")}{" "}
                {t("portfolio.contributions.averageBasis", { count: model.averageMonths })}
              </p>
            </div>
            <details className="border-t border-border/50">
              <summary className="cursor-pointer px-4 py-3 text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring md:px-5">
                {t("portfolio.contributions.monthlyDetails")}
              </summary>
              <div className="overflow-x-auto px-4 pb-4 md:px-5">
                <table className="w-full text-left text-xs tabular-nums">
                  <caption className="sr-only">
                    {t("portfolio.contributions.chartLabel", {
                      year,
                      total: fmtCurrency(model.total, currency),
                    })}
                  </caption>
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th scope="col" className="py-2 pr-4">
                        {t("portfolio.contributions.month")}
                      </th>
                      {series.map((item) => (
                        <th
                          key={item.id}
                          scope="col"
                          className="whitespace-nowrap px-3 py-2 text-right"
                        >
                          {item.name}
                        </th>
                      ))}
                      <th scope="col" className="whitespace-nowrap px-3 py-2 text-right">
                        {t("portfolio.contributions.freshMoney")}
                      </th>
                      {model.withdrawals > 0 ? (
                        <th scope="col" className="whitespace-nowrap pl-3 py-2 text-right">
                          {t("portfolio.contributions.withdrawals")}
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {model.months.map((month) => (
                      <tr
                        key={month.month}
                        className={`border-b border-border/30 ${month.state === "current" ? "bg-primary/5" : ""}`}
                      >
                        <th scope="row" className="whitespace-nowrap py-2 pr-4 font-normal">
                          {monthName(year, month.month, locale, "long")}
                          {month.state !== "elapsed" ? (
                            <span className="ml-2 text-muted-foreground">
                              · {t(`portfolio.contributions.${month.state}`)}
                            </span>
                          ) : null}
                        </th>
                        {series.map((item) => (
                          <td key={item.id} className="whitespace-nowrap px-3 py-2 text-right">
                            {month.state === "future"
                              ? "—"
                              : fmtCurrency(month.byPortfolio[item.id] ?? 0, currency)}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                          {month.state === "future" ? "—" : fmtCurrency(month.total, currency)}
                        </td>
                        {model.withdrawals > 0 ? (
                          <td className="whitespace-nowrap pl-3 py-2 text-right">
                            {month.state === "future"
                              ? "—"
                              : fmtCurrency(month.withdrawals, currency)}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="font-semibold">
                    <tr>
                      <th scope="row" className="py-3 pr-4">
                        {t("portfolio.total")}
                      </th>
                      {series.map((item) => (
                        <td key={item.id} className="whitespace-nowrap px-3 py-3 text-right">
                          {fmtCurrency(
                            model.months.reduce(
                              (sum, month) => sum + (month.byPortfolio[item.id] ?? 0),
                              0,
                            ),
                            currency,
                          )}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {fmtCurrency(model.total, currency)}
                      </td>
                      {model.withdrawals > 0 ? (
                        <td className="whitespace-nowrap pl-3 py-3 text-right">
                          {fmtCurrency(model.withdrawals, currency)}
                        </td>
                      ) : null}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  );
}

function ContributionStat({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div
        className={`mt-2 font-bold tracking-tight tabular-nums ${primary ? "text-2xl md:text-[28px]" : "text-lg md:text-xl"}`}
      >
        {value}
      </div>
    </div>
  );
}

function monthName(year: number, month: number, locale: string, format: "short" | "long") {
  return new Intl.DateTimeFormat(locale, { month: format }).format(new Date(year, month, 1));
}

function ContributionMonthTick({
  x = 0,
  y = 0,
  payload,
  months,
  year,
  locale,
}: {
  x?: number;
  y?: number;
  payload?: { value: number };
  months: ContributionMonth[];
  year: number;
  locale: string;
}) {
  const { t } = useTranslation();
  const month = payload ? months[payload.value] : undefined;
  if (!month) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <title>
        {monthName(year, month.month, locale, "long")}
        {month.state !== "elapsed" ? ` · ${t(`portfolio.contributions.${month.state}`)}` : ""}
      </title>
      <text
        y={14}
        textAnchor="middle"
        fill={month.state === "current" ? "var(--color-primary)" : "var(--color-muted-foreground)"}
        opacity={month.state === "future" ? 0.4 : 1}
        className="text-[8px] sm:text-[9px]"
        fontWeight={month.state === "current" ? 700 : 400}
      >
        {monthName(year, month.month, locale, "short")}
      </text>
      {month.state === "current" ? <circle cy={24} r={2} fill="var(--color-primary)" /> : null}
    </g>
  );
}

function ContributionTooltip({
  active,
  payload,
  series,
  currency,
  year,
  locale,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: ContributionMonth }>;
  series: Series[];
  currency: string;
  year: number;
  locale: string;
}) {
  const { t } = useTranslation();
  const month = payload?.[0]?.payload;
  if (!active || !month) return null;
  return (
    <div className="max-w-[280px] space-y-2 rounded-md border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
      <div className="font-semibold">
        {monthName(year, month.month, locale, "long")} {year}
      </div>
      {month.state === "future" ? (
        <p className="text-muted-foreground">{t("portfolio.contributions.future")}</p>
      ) : (
        <>
          <div className="flex justify-between gap-5 font-bold">
            <span>{t("portfolio.total")}</span>
            <span>{fmtCurrency(month.total, currency)}</span>
          </div>
          {series
            .filter((item) => month.byPortfolio[item.id] > 0)
            .map((item) => (
              <div key={item.id} className="flex justify-between gap-5">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ background: item.color }}
                  />
                  {item.name}
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  {fmtCurrency(month.byPortfolio[item.id], currency)}
                </span>
              </div>
            ))}
          {month.withdrawals > 0 ? (
            <div className="flex justify-between gap-5 border-t border-border/50 pt-2 text-muted-foreground">
              <span>{t("portfolio.contributions.withdrawals")}</span>
              <span>{fmtCurrency(month.withdrawals, currency)}</span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
