import { Link } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { TerminalTable } from "@/components/terminal/TerminalTable";
import type { ServiceVisitWithJobs, Vehicle } from "@/routes/_authenticated/car-service/types";
import {
  formatCurrency,
  formatDate,
  formatKm,
} from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";

type JobsSortKey = "job" | "category" | "qty" | "unit" | "subtotal" | "total";
type JobsSortDirection = "asc" | "desc";

function NoteIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
      <path d="M2 1h8v10H2V1zm1 1v8h6V2H3zm1 2h4v1H4V4zm0 2h4v1H4V6z" className="fill-current" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
      <path
        d="M7.8 1.2a2.6 2.6 0 0 0-1.6 4.6L2.1 9.9a.7.7 0 0 0 0 1l.3.3a.7.7 0 0 0 1 0l4.1-4.1a2.6 2.6 0 0 0 3-4l-1.4 1.4-1.5-.3-.3-1.5 1.4-1.4a2.6 2.6 0 0 0-.9-.1Z"
        className="fill-current"
      />
    </svg>
  );
}

export function ServiceHistoryTable({
  visits = [],
  vehicles = [],
  isLoading = false,
  selectedVehicleId = "all",
  expandedVisitIds,
  onToggleExpanded,
  emptyMessage,
}: {
  visits?: ServiceVisitWithJobs[];
  vehicles?: Vehicle[];
  isLoading?: boolean;
  selectedVehicleId?: string;
  expandedVisitIds: Set<string>;
  onToggleExpanded: (visitId: string) => void;
  emptyMessage?: string;
}) {
  const { t } = useTranslation();
  const [jobsSortByVisit, setJobsSortByVisit] = useState<
    Record<string, { key: JobsSortKey; dir: JobsSortDirection }>
  >({});

  const toggleJobsSort = (visitId: string, key: JobsSortKey) => {
    setJobsSortByVisit((prev) => {
      const current = prev[visitId] ?? { key: "job" as const, dir: "asc" as const };
      if (current.key === key)
        return { ...prev, [visitId]: { key, dir: current.dir === "asc" ? "desc" : "asc" } };
      return { ...prev, [visitId]: { key, dir: "asc" } };
    });
  };

  const vehicleNames = new Map(
    vehicles.map((vehicle) => [
      vehicle.id,
      `${vehicle.make ?? "-"} ${vehicle.model ?? "-"}`.trim().toUpperCase(),
    ]),
  );

  return (
    <>
      <div className="space-y-2 md:hidden">
        {isLoading ? <MobileState>{t("common.loading")}</MobileState> : null}
        {!isLoading && visits.length === 0 ? (
          <MobileState>{emptyMessage ?? t("car.noServiceRecordsFound")}</MobileState>
        ) : null}
        {visits.map((visit) => {
          const expanded = expandedVisitIds.has(visit.id);
          return (
            <article
              key={visit.id}
              className={`analytics-panel overflow-hidden rounded-[10px] border bg-card/80 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] ${
                expanded ? "border-primary/40" : "border-border/70"
              }`}
            >
              <button
                type="button"
                onClick={() => onToggleExpanded(visit.id)}
                aria-expanded={expanded}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-primary">{formatDate(visit.service_date)}</span>
                    {visit.is_annual_service ? (
                      <span className="text-primary" title={t("car.markAsAnnualService")}>
                        <WrenchIcon />
                      </span>
                    ) : null}
                    {visit.notes?.trim() ? (
                      <span className="text-muted-foreground" title={t("car.visitHasNote")}>
                        <NoteIcon />
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {vehicleNames.get(visit.vehicle_id) ?? "-"} · {visit.workshop ?? "-"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold tabular-nums text-foreground">
                    {formatCurrency(Number(visit.total_amount))}
                  </span>
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {expanded ? "▼" : "▶"}
                  </span>
                </span>
              </button>
              <div className="grid grid-cols-2 border-t border-border/50 text-[10px] uppercase tracking-[0.08em]">
                <MobileFact label={t("car.km")} value={formatKm(visit.odometer_km)} />
                <MobileFact
                  label={t("car.jobsCount")}
                  value={`${visit.jobs.length} ${t("car.jobs")}`}
                  right
                />
              </div>
              {expanded ? (
                <div className="border-t border-primary/20 bg-background/35 p-3">
                  {visit.notes?.trim() ? (
                    <div className="mb-2 rounded-md bg-secondary/25 p-2 text-[11px] text-muted-foreground">
                      <span className="uppercase text-primary">{t("car.noteLabel")}:</span>{" "}
                      {visit.notes.trim()}
                    </div>
                  ) : null}
                  <div className="space-y-1">
                    {visit.jobs.length === 0 ? (
                      <div className="py-2 text-[10px] uppercase text-muted-foreground">
                        {t("car.noJobDetails")}
                      </div>
                    ) : (
                      visit.jobs.map((job) => (
                        <div
                          key={job.id}
                          className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-md px-2 py-2 text-[11px] odd:bg-secondary/20"
                        >
                          <span className="min-w-0 truncate text-foreground">
                            {job.job_name_snapshot}
                          </span>
                          <span className="tabular-nums text-foreground">
                            {formatCurrency(
                              Number(job.line_total_ex_vat) * (1 + Number(visit.vat_rate)),
                            )}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <Link
                    to="/car-service/$visitId"
                    params={{ visitId: visit.id }}
                    search={{ vehicleId: selectedVehicleId, visitId: visit.id }}
                    className="mt-3 inline-flex h-9 items-center rounded-md border border-primary/35 px-3 text-[10px] uppercase tracking-[0.14em] text-primary"
                  >
                    {t("common.edit")}
                  </Link>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="hidden md:block">
        <TerminalTable variant="panel" className="font-mono text-[11px]">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">{t("car.date")}</th>
              <th className="px-3 py-2 text-right">{t("car.km")}</th>
              <th className="px-3 py-2 text-left">{t("car.garage")}</th>
              <th className="px-3 py-2 text-right">{t("car.jobsCount")}</th>
              <th className="px-3 py-2 text-right">{t("car.subtotal")}</th>
              <th className="px-3 py-2 text-right">{t("car.total")}</th>
              <th className="w-16 px-2 py-2 text-right" aria-label={t("car.indicators")}></th>
              <th className="w-20 px-2 py-2 text-right">{t("car.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                <tr className="border-t border-border/60 opacity-50">
                  <td colSpan={8} className="px-3 py-3 text-muted-foreground">
                    ...
                  </td>
                </tr>
                <tr className="border-t border-border/60 opacity-50">
                  <td colSpan={8} className="px-3 py-3 text-muted-foreground">
                    ...
                  </td>
                </tr>
                <tr className="border-t border-border/60 opacity-50">
                  <td colSpan={8} className="px-3 py-3 text-muted-foreground">
                    ...
                  </td>
                </tr>
              </>
            ) : visits.length === 0 ? (
              <tr className="border-t border-border/60">
                <td
                  colSpan={8}
                  className="p-6 text-center text-muted-foreground uppercase tracking-[0.2em]"
                >
                  {emptyMessage ?? t("car.noServiceRecordsFound")}
                </td>
              </tr>
            ) : (
              visits.map((visit, index) => {
                const expanded = expandedVisitIds.has(visit.id);
                const sort = jobsSortByVisit[visit.id] ?? {
                  key: "job" as const,
                  dir: "asc" as const,
                };
                const mark = (key: JobsSortKey) =>
                  sort.key === key ? (sort.dir === "asc" ? " ↑" : " ↓") : "";

                const collapsedTone = index % 2 === 0 ? "bg-transparent" : "bg-secondary/10";

                const sortedJobs = [...visit.jobs].sort((a, b) => {
                  const dir = sort.dir === "asc" ? 1 : -1;
                  switch (sort.key) {
                    case "job":
                      return a.job_name_snapshot.localeCompare(b.job_name_snapshot) * dir;
                    case "category":
                      return (
                        (a.category_snapshot ?? "").localeCompare(b.category_snapshot ?? "") * dir
                      );
                    case "qty":
                      return (Number(a.quantity) - Number(b.quantity)) * dir;
                    case "unit":
                      return (Number(a.unit_price_ex_vat) - Number(b.unit_price_ex_vat)) * dir;
                    case "subtotal":
                      return (Number(a.line_total_ex_vat) - Number(b.line_total_ex_vat)) * dir;
                    case "total":
                      return (
                        (Number(a.line_total_ex_vat) * (1 + Number(visit.vat_rate)) -
                          Number(b.line_total_ex_vat) * (1 + Number(visit.vat_rate))) *
                        dir
                      );
                  }
                });

                return (
                  <Fragment key={visit.id}>
                    <tr
                      className={`border-t cursor-pointer transition-colors ${
                        expanded
                          ? "border-primary/40 bg-primary/5 text-foreground/90 shadow-[inset_3px_0_0_0_rgba(255,153,0,0.75)]"
                          : `border-border/60 text-foreground/80 hover:bg-secondary/30 ${collapsedTone}`
                      }`}
                      onClick={() => onToggleExpanded(visit.id)}
                    >
                      <td className="px-3 py-2 text-left font-normal">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleExpanded(visit.id);
                          }}
                          className="mr-2 text-muted-foreground hover:text-foreground"
                          aria-expanded={expanded}
                          aria-label={expanded ? t("car.collapseDetails") : t("car.expandDetails")}
                        >
                          {expanded ? "\u25BC" : "\u25B6"}
                        </button>
                        {formatDate(visit.service_date)}
                      </td>
                      <td className="px-3 py-2 text-right font-normal">
                        {formatKm(visit.odometer_km)}
                      </td>
                      <td className="px-3 py-2 text-left font-normal">{visit.workshop ?? "-"}</td>
                      <td className="px-3 py-2 text-right font-normal">
                        {visit.jobs.length} {t("car.jobs")}
                      </td>
                      <td className="px-3 py-2 text-right font-normal">
                        {formatCurrency(Number(visit.subtotal_ex_vat))}
                      </td>
                      <td className="px-3 py-2 text-right font-normal">
                        {formatCurrency(Number(visit.total_amount))}
                      </td>
                      <td className="w-16 px-2 py-2">
                        <div className="flex items-center justify-end gap-2">
                          {visit.notes?.trim() ? (
                            <span
                              className="inline-flex text-muted-foreground hover:text-foreground"
                              aria-label={t("car.visitHasNote")}
                              title={t("car.visitHasNote")}
                            >
                              <NoteIcon />
                            </span>
                          ) : null}
                          {visit.is_annual_service ? (
                            <span
                              className="inline-flex text-primary"
                              aria-label={t("car.markAsAnnualService")}
                              title={t("car.markAsAnnualService")}
                            >
                              <WrenchIcon />
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="w-20 px-2 py-2 text-right whitespace-nowrap font-normal">
                        <Link
                          to="/car-service/$visitId"
                          params={{ visitId: visit.id }}
                          search={{ vehicleId: selectedVehicleId, visitId: visit.id }}
                          onClick={(event) => {
                            event.stopPropagation();
                            try {
                              sessionStorage.setItem(
                                "carServiceHistoryContext",
                                JSON.stringify({ vehicleId: selectedVehicleId, visitId: visit.id }),
                              );
                            } catch {
                              // ignore storage failures
                            }
                          }}
                          className="text-primary uppercase hover:underline"
                        >
                          [{t("common.edit").toUpperCase()}]
                        </Link>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-primary/20 bg-background/70">
                        <td colSpan={8} className="px-3 py-3">
                          <div className="border border-primary/20 bg-secondary/10 shadow-[inset_0_1px_0_rgba(255,153,0,0.08)]">
                            <div className="flex items-center justify-between border-b border-primary/15 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-primary">
                              <span>{t("car.details")}</span>
                              <span className="text-muted-foreground">
                                {formatDate(visit.service_date)} // {visit.jobs.length}{" "}
                                {t("car.jobs")}
                              </span>
                            </div>
                            <div className="px-3 py-3">
                              {visit.notes?.trim() ? (
                                <div className="mb-3 border-b border-primary/10 pb-2 text-[10px] uppercase tracking-[0.16em]">
                                  <span className="text-muted-foreground">
                                    {t("car.noteLabel")}:
                                  </span>{" "}
                                  <span className="text-foreground normal-case tracking-normal">
                                    {visit.notes.trim()}
                                  </span>
                                </div>
                              ) : null}
                              {visit.jobs.length === 0 ? (
                                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                  {t("car.noJobDetails")}
                                </div>
                              ) : (
                                <div className="overflow-x-auto border border-border/50 bg-background/40">
                                  <table className="w-full text-[10px] uppercase tracking-[0.16em]">
                                    <thead className="bg-secondary/30 text-muted-foreground">
                                      <tr>
                                        <th
                                          className="px-2 py-2 text-left cursor-pointer select-none"
                                          onClick={() => toggleJobsSort(visit.id, "job")}
                                        >
                                          {t("car.job")}
                                          {mark("job")}
                                        </th>
                                        <th
                                          className="px-2 py-2 text-left cursor-pointer select-none"
                                          onClick={() => toggleJobsSort(visit.id, "category")}
                                        >
                                          {t("car.category")}
                                          {mark("category")}
                                        </th>
                                        <th
                                          className="px-2 py-2 text-right cursor-pointer select-none"
                                          onClick={() => toggleJobsSort(visit.id, "qty")}
                                        >
                                          {t("car.qty")}
                                          {mark("qty")}
                                        </th>
                                        <th
                                          className="px-2 py-2 text-right cursor-pointer select-none"
                                          onClick={() => toggleJobsSort(visit.id, "unit")}
                                        >
                                          {t("car.unit")}
                                          {mark("unit")}
                                        </th>
                                        <th
                                          className="px-2 py-2 text-right cursor-pointer select-none"
                                          onClick={() => toggleJobsSort(visit.id, "subtotal")}
                                        >
                                          {t("car.subtotal")}
                                          {mark("subtotal")}
                                        </th>
                                        <th
                                          className="px-2 py-2 text-right cursor-pointer select-none"
                                          onClick={() => toggleJobsSort(visit.id, "total")}
                                        >
                                          {t("car.total")}
                                          {mark("total")}
                                        </th>
                                        <th className="px-2 py-2 text-left">
                                          {t("portfolio.notes")}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortedJobs.map((job, jobIndex) => (
                                        <tr
                                          key={job.id}
                                          className={`border-t border-border/40 text-foreground/80 hover:bg-secondary/10 ${
                                            jobIndex % 2 === 0
                                              ? "bg-transparent"
                                              : "bg-secondary/10"
                                          }`}
                                        >
                                          <td className="px-2 py-1.5 text-left font-normal">
                                            {job.job_name_snapshot}
                                          </td>
                                          <td className="px-2 py-1 text-left font-normal">
                                            {job.category_snapshot ?? "-"}
                                          </td>
                                          <td className="px-2 py-1 text-right font-normal">
                                            {job.quantity}
                                          </td>
                                          <td className="px-2 py-1 text-right font-normal">
                                            {formatCurrency(Number(job.unit_price_ex_vat))}
                                          </td>
                                          <td className="px-2 py-1 text-right font-normal">
                                            {formatCurrency(Number(job.line_total_ex_vat))}
                                          </td>
                                          <td className="px-2 py-1 text-right font-normal">
                                            {formatCurrency(
                                              Number(job.line_total_ex_vat) *
                                                (1 + Number(visit.vat_rate)),
                                            )}
                                          </td>
                                          <td className="px-2 py-1 text-left font-normal">
                                            {job.notes ?? "-"}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </TerminalTable>
      </div>
    </>
  );
}

function MobileState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] border border-border/70 bg-card/70 p-6 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </div>
  );
}

function MobileFact({
  label,
  value,
  right = false,
}: {
  label: string;
  value: string;
  right?: boolean;
}) {
  return (
    <div className={`px-3 py-2.5 ${right ? "border-l border-border/50 text-right" : ""}`}>
      <div className="text-[9px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-semibold normal-case tracking-normal tabular-nums text-foreground">
        {value}
      </div>
    </div>
  );
}
