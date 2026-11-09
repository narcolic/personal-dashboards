import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { billYears, energyAnalytics } from "@/lib/energy/analytics";
import type { EnergyBill } from "@/lib/energy/types";

type Props = {
  bills: EnergyBill[];
  onOpen: (bill: EnergyBill) => void;
  onDelete: (bill: EnergyBill) => void;
};
export function EnergyOverview({ bills, onOpen, onDelete }: Props) {
  const { t, i18n } = useTranslation();
  const years = billYears(bills);
  const [selectedYear, setYear] = useState<number | null>(null);
  const [supply, setSupply] = useState("");
  const [measure, setMeasure] = useState<"cost" | "kwh">("cost");
  const [removing, setRemoving] = useState<string | null>(null);
  const year =
    selectedYear != null && years.includes(selectedYear)
      ? selectedYear
      : (years[0] ?? new Date().getFullYear());
  const supplies = [...new Set(bills.map((bill) => bill.summary.supplyNumber))];
  const activeSupply = supplies.includes(supply) ? supply : "";
  const filtered = bills.filter(
    (bill) => !activeSupply || bill.summary.supplyNumber === activeSupply,
  );
  const data = energyAnalytics(filtered, year);
  const money = (value: number | null) =>
    value == null
      ? "—"
      : new Intl.NumberFormat(i18n.language, { style: "currency", currency: "EUR" }).format(value);
  const number = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(
      new Date(`${value}T12:00:00`),
    );
  const chartData = data.months.map((month) => ({
    ...month,
    label: new Intl.DateTimeFormat(i18n.language, { month: "short" }).format(
      new Date(year, month.month, 15),
    ),
  }));
  const colors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
  const breakdown = Object.entries(data.breakdown);
  const maxCharge = Math.max(1, ...breakdown.map(([, value]) => Math.abs(value)));
  return (
    <>
      <div className="energy-row">
        <div className="energy-actions">
          <label className="energy-label">
            {t("energy.year")}
            <select
              className="energy-input"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {(years.length ? years : [year]).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {supplies.length > 1 && (
            <label className="energy-label">
              {t("energy.fields.supplyNumber")}
              <select
                className="energy-input"
                value={activeSupply}
                onChange={(event) => setSupply(event.target.value)}
              >
                <option value="">{t("energy.allSupplies")}</option>
                {supplies.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <span className="energy-muted text-xs">
          {t("energy.coverage", { days: data.coveredDays, total: data.totalDays })}
        </span>
      </div>
      <section className="energy-panel energy-metrics" aria-label={t("energy.summary")}>
        <article>
          <p className="energy-muted text-xs">{t("energy.billedCost")}</p>
          <strong>{money(data.totalCost)}</strong>
          <p className="energy-muted text-xs">
            {t("energy.invoiceCount", { count: data.issued.length })} · {year}
          </p>
        </article>
        <article>
          <p className="energy-muted text-xs">{t("energy.consumption")}</p>
          <strong>
            {data.coveredDays ? number(data.totalKwh) : "—"} <span>kWh</span>
          </strong>
          <p className="energy-muted text-xs">
            {t("energy.coveredPeriods")}
            {data.estimatedKwh > 0
              ? ` · ${t("energy.estimated")}: ${number(data.estimatedKwh)} kWh`
              : ""}
          </p>
        </article>
        <article>
          <p className="energy-muted text-xs">{t("energy.averageMonthly")}</p>
          <strong>{money(data.averageMonthly)}</strong>
          <p className="energy-muted text-xs">
            {t("energy.recordedMonths", { count: data.recordedMonths })}
          </p>
        </article>
      </section>
      <div className="energy-overview-grid">
        <section className="energy-panel">
          <div className="energy-panel-head energy-row">
            <h2>{t("energy.monthlyTrend")}</h2>
            <div className="energy-actions" role="group" aria-label={t("energy.chartMeasure")}>
              {(["cost", "kwh"] as const).map((value) => (
                <button
                  key={value}
                  className="energy-button energy-toggle"
                  aria-pressed={measure === value}
                  onClick={() => setMeasure(value)}
                  type="button"
                >
                  {t(`energy.${value}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="energy-panel-body">
            <p className="energy-muted text-xs mb-4">
              {t(measure === "cost" ? "energy.issueMonthBasis" : "energy.allocationBasis")}
            </p>
            <div
              role="img"
              aria-label={t(
                measure === "cost" ? "energy.costChartDescription" : "energy.kwhChartDescription",
              )}
            >
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={8}
                  />
                  <YAxis
                    width={50}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => number(value)}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--secondary)" }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--foreground)",
                    }}
                    formatter={(value) =>
                      measure === "cost" ? money(Number(value)) : `${number(Number(value))} kWh`
                    }
                  />
                  <Bar
                    name={t(measure === "cost" ? "energy.cost" : "energy.kwh")}
                    dataKey={measure}
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={34}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="energy-muted text-xs mt-3">{t("energy.missingMonths")}</p>
            <details className="mt-3">
              <summary className="text-xs">{t("energy.showMonthlyValues")}</summary>
              <div className="energy-table-wrap">
                <table className="energy-table">
                  <thead>
                    <tr>
                      <th>{t("energy.month")}</th>
                      <th>{t("energy.cost")}</th>
                      <th>{t("energy.kwh")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((month) => (
                      <tr key={month.month}>
                        <td>{month.label}</td>
                        <td>{money(month.cost)}</td>
                        <td>{month.kwh == null ? "—" : number(month.kwh)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </section>
        <section className="energy-panel">
          <div className="energy-panel-head">
            <h2>{t("energy.breakdown")}</h2>
          </div>
          <div className="energy-panel-body space-y-5">
            {breakdown.map(([key, value], i) => (
              <div key={key}>
                <div className="energy-row text-sm">
                  <span>{t(`energy.fields.${key}`)}</span>
                  <span className="tabular-nums">{money(value)}</span>
                </div>
                <div className="energy-charge-track">
                  <div
                    style={{
                      width: `${(Math.abs(value) / maxCharge) * 100}%`,
                      background: colors[i],
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="energy-muted text-xs">{t("energy.breakdownNote")}</p>
          </div>
        </section>
      </div>
      <section className="energy-panel">
        <div className="energy-panel-head">
          <h2>{t("energy.bills")}</h2>
        </div>
        <div className="energy-table-wrap">
          <table className="energy-table">
            <thead>
              <tr>
                <th>{t("energy.fields.issueDate")}</th>
                <th>{t("energy.providerPeriod")}</th>
                <th>{t("energy.fields.billType")}</th>
                <th>kWh</th>
                <th>{t("energy.fields.currentTotal")}</th>
                <th>{t("energy.fields.amountDue")}</th>
                <th aria-label={t("energy.actions")} />
              </tr>
            </thead>
            <tbody>
              {data.issued.map((bill) => (
                <tr key={bill.id}>
                  <td>{date(bill.summary.issueDate)}</td>
                  <td>
                    <span>{bill.summary.provider}</span>
                    <span className="block energy-muted text-xs">
                      {date(bill.summary.periodStart)} – {date(bill.summary.periodEnd)}
                    </span>
                  </td>
                  <td>{t(`energy.${bill.summary.billType}`)}</td>
                  <td>{number(bill.summary.kwh)}</td>
                  <td>{money(bill.summary.currentTotal)}</td>
                  <td>{money(bill.summary.amountDue)}</td>
                  <td>
                    <div className="energy-actions">
                      <button className="energy-button" type="button" onClick={() => onOpen(bill)}>
                        {t("energy.view")}
                      </button>
                      <button
                        className="energy-button"
                        type="button"
                        aria-label={t("energy.deleteInvoice", {
                          invoice: bill.summary.invoiceNumber ?? bill.summary.issueDate,
                        })}
                        onClick={() => setRemoving(bill.id)}
                      >
                        {t("energy.delete")}
                      </button>
                    </div>
                    {removing === bill.id && (
                      <div className="energy-notice mt-2">
                        <p className="mb-2">{t("energy.deleteConfirm")}</p>
                        <div className="energy-actions">
                          <button
                            className="energy-button"
                            onClick={() => setRemoving(null)}
                            type="button"
                          >
                            {t("energy.cancel")}
                          </button>
                          <button
                            className="energy-button"
                            onClick={() => {
                              setRemoving(null);
                              onDelete(bill);
                            }}
                            type="button"
                          >
                            {t("energy.confirmDelete")}
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.issued.length === 0 && (
          <p className="energy-panel-body energy-muted">{t("energy.noInvoicesYear")}</p>
        )}
      </section>
      <section className="energy-panel">
        <div className="energy-panel-head">
          <h2>{t("energy.yearComparison")}</h2>
        </div>
        {years.length < 2 ? (
          <p className="energy-panel-body energy-muted text-sm">{t("energy.needMoreYears")}</p>
        ) : (
          <div className="energy-panel-body">
            <p className="energy-muted text-xs mb-3">{t("energy.comparisonNote")}</p>
            <div className="energy-table-wrap">
              <table className="energy-table">
                <thead>
                  <tr>
                    <th>{t("energy.year")}</th>
                    <th>{t("energy.billedCost")}</th>
                    <th>kWh</th>
                    <th>{t("energy.dailyKwh")}</th>
                    <th>{t("energy.coveredDays")}</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((value) => {
                    const annual = energyAnalytics(filtered, value);
                    return (
                      <tr key={value}>
                        <td>{value}</td>
                        <td>{money(annual.totalCost)}</td>
                        <td>{annual.coveredDays ? number(annual.totalKwh) : "—"}</td>
                        <td>
                          {annual.averageDailyKwh == null ? "—" : number(annual.averageDailyKwh)}
                        </td>
                        <td>
                          {annual.coveredDays} / {annual.totalDays}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
