import { Link } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { TerminalTable } from "@/components/terminal/TerminalTable";
import type { ServiceVisitWithJobs } from "@/routes/_authenticated/car-service/types";
import { formatCurrency, formatDate, formatKm } from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";

type JobsSortKey = "job" | "category" | "qty" | "unit" | "subtotal" | "total";
type JobsSortDirection = "asc" | "desc";

export function ServiceHistoryTable({ visits = [], isLoading = false }: { visits?: ServiceVisitWithJobs[]; isLoading?: boolean }) {
  const { t } = useTranslation();
  const [expandedVisitIds, setExpandedVisitIds] = useState<Set<string>>(new Set());
  const [jobsSortByVisit, setJobsSortByVisit] = useState<Record<string, { key: JobsSortKey; dir: JobsSortDirection }>>({});

  const toggleExpanded = (visitId: string) => {
    setExpandedVisitIds((prev) => {
      const next = new Set(prev);
      if (next.has(visitId)) next.delete(visitId);
      else next.add(visitId);
      return next;
    });
  };

  const toggleJobsSort = (visitId: string, key: JobsSortKey) => {
    setJobsSortByVisit((prev) => {
      const current = prev[visitId] ?? { key: "job" as const, dir: "asc" as const };
      if (current.key === key) return { ...prev, [visitId]: { key, dir: current.dir === "asc" ? "desc" : "asc" } };
      return { ...prev, [visitId]: { key, dir: "asc" } };
    });
  };

  return (
    <TerminalTable variant="panel" className="font-mono text-[11px]">
      <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <tr>
          <th className="px-3 py-2 text-left">{t("car.date")}</th>
          <th className="px-3 py-2 text-right">{t("car.km")}</th>
          <th className="px-3 py-2 text-left">{t("car.garage")}</th>
          <th className="px-3 py-2 text-right">{t("car.jobsCount")}</th>
          <th className="px-3 py-2 text-right">{t("car.subtotal")}</th>
          <th className="px-3 py-2 text-right">{t("car.total")}</th>
          <th className="px-3 py-2 text-right">{t("car.actions")}</th>
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <>
            <tr className="border-t border-border/60 opacity-50"><td colSpan={7} className="px-3 py-3 text-muted-foreground">...</td></tr>
            <tr className="border-t border-border/60 opacity-50"><td colSpan={7} className="px-3 py-3 text-muted-foreground">...</td></tr>
            <tr className="border-t border-border/60 opacity-50"><td colSpan={7} className="px-3 py-3 text-muted-foreground">...</td></tr>
          </>
        ) : visits.length === 0 ? (
          <tr className="border-t border-border/60">
            <td colSpan={7} className="p-6 text-center text-muted-foreground uppercase tracking-[0.2em]">{t("car.noServiceRecordsFound")}</td>
          </tr>
        ) : (
          visits.map((visit) => {
            const expanded = expandedVisitIds.has(visit.id);
            const sort = jobsSortByVisit[visit.id] ?? { key: "job" as const, dir: "asc" as const };
            const mark = (key: JobsSortKey) => (sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : "");

            const sortedJobs = [...visit.jobs].sort((a, b) => {
              const dir = sort.dir === "asc" ? 1 : -1;
              switch (sort.key) {
                case "job": return a.job_name_snapshot.localeCompare(b.job_name_snapshot) * dir;
                case "category": return (a.category_snapshot ?? "").localeCompare(b.category_snapshot ?? "") * dir;
                case "qty": return (Number(a.quantity) - Number(b.quantity)) * dir;
                case "unit": return (Number(a.unit_price_ex_vat) - Number(b.unit_price_ex_vat)) * dir;
                case "subtotal": return (Number(a.line_total_ex_vat) - Number(b.line_total_ex_vat)) * dir;
                case "total": return (Number(a.line_total_ex_vat) * (1 + Number(visit.vat_rate)) - Number(b.line_total_ex_vat) * (1 + Number(visit.vat_rate))) * dir;
              }
            });

            return (
              <Fragment key={visit.id}>
                <tr className="border-t border-border/60 hover:bg-secondary/30 cursor-pointer" onClick={() => toggleExpanded(visit.id)}>
                  <td className="px-3 py-2 text-left">
                    <button type="button" onClick={(event) => { event.stopPropagation(); toggleExpanded(visit.id); }} className="mr-2 text-muted-foreground hover:text-foreground" aria-expanded={expanded} aria-label={expanded ? t("car.collapseDetails") : t("car.expandDetails")}>
                      {expanded ? "v" : ">"}
                    </button>
                    {formatDate(visit.service_date)}
                  </td>
                  <td className="px-3 py-2 text-right">{formatKm(visit.odometer_km)}</td>
                  <td className="px-3 py-2 text-left">{visit.workshop ?? "-"}</td>
                  <td className="px-3 py-2 text-right">{visit.jobs.length} {t("car.jobs")}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(Number(visit.subtotal_ex_vat))}</td>
                  <td className="px-3 py-2 text-right">{formatCurrency(Number(visit.total_amount))}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Link to="/car-service/$visitId" params={{ visitId: visit.id }} onClick={(event) => event.stopPropagation()} className="text-primary uppercase hover:underline">
                      {t("common.edit")}
                    </Link>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-t border-border/40 bg-secondary/20">
                    <td colSpan={7} className="px-3 py-3">
                      {visit.jobs.length === 0 ? (
                        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t("car.noJobDetails")}</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-[10px] uppercase tracking-[0.16em]">
                            <thead className="text-muted-foreground">
                              <tr>
                                <th className="px-2 py-1 text-left cursor-pointer select-none" onClick={() => toggleJobsSort(visit.id, "job")}>{t("car.job")}{mark("job")}</th>
                                <th className="px-2 py-1 text-left cursor-pointer select-none" onClick={() => toggleJobsSort(visit.id, "category")}>{t("car.category")}{mark("category")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer select-none" onClick={() => toggleJobsSort(visit.id, "qty")}>{t("car.qty")}{mark("qty")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer select-none" onClick={() => toggleJobsSort(visit.id, "unit")}>{t("car.unit")}{mark("unit")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer select-none" onClick={() => toggleJobsSort(visit.id, "subtotal")}>{t("car.subtotal")}{mark("subtotal")}</th>
                                <th className="px-2 py-1 text-right cursor-pointer select-none" onClick={() => toggleJobsSort(visit.id, "total")}>{t("car.total")}{mark("total")}</th>
                                <th className="px-2 py-1 text-left">{t("portfolio.notes")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedJobs.map((job) => (
                                <tr key={job.id} className="border-t border-border/40">
                                  <td className="px-2 py-1 text-left">{job.job_name_snapshot}</td>
                                  <td className="px-2 py-1 text-left">{job.category_snapshot ?? "-"}</td>
                                  <td className="px-2 py-1 text-right">{job.quantity}</td>
                                  <td className="px-2 py-1 text-right">{formatCurrency(Number(job.unit_price_ex_vat))}</td>
                                  <td className="px-2 py-1 text-right">{formatCurrency(Number(job.line_total_ex_vat))}</td>
                                  <td className="px-2 py-1 text-right">{formatCurrency(Number(job.line_total_ex_vat) * (1 + Number(visit.vat_rate)))}</td>
                                  <td className="px-2 py-1 text-left">{job.notes ?? "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })
        )}
      </tbody>
    </TerminalTable>
  );
}
