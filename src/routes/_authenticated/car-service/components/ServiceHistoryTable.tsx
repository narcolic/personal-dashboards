import { Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
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

function EditIcon() {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
      <path
        d="M8.7 1.3a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4L4.2 9.8 1 11l1.2-3.2 6.5-6.5Zm-5.6 7 .8.8 5.7-5.7-.8-.8-5.7 5.7ZM2.6 9.1l-.3.7.7-.3-.4-.4Z"
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
  showVehicle = false,
  expandedVisitIds,
  onToggleExpanded,
  emptyMessage,
  onClearEmpty,
}: {
  visits?: ServiceVisitWithJobs[];
  vehicles?: Vehicle[];
  isLoading?: boolean;
  selectedVehicleId?: string;
  showVehicle?: boolean;
  expandedVisitIds: Set<string>;
  onToggleExpanded: (visitId: string) => void;
  emptyMessage?: string;
  onClearEmpty?: () => void;
}) {
  const { t } = useTranslation();
  const [jobsSortByVisit, setJobsSortByVisit] = useState<
    Record<string, { key: JobsSortKey; dir: JobsSortDirection }>
  >({});

  const vehicleNames = useMemo(
    () =>
      new Map(
        vehicles.map((vehicle) => [
          vehicle.id,
          `${vehicle.make ?? "-"} ${vehicle.model ?? "-"}`.trim().toUpperCase(),
        ]),
      ),
    [vehicles],
  );
  const columnCount = showVehicle ? 8 : 7;

  const toggleJobsSort = (visitId: string, key: JobsSortKey) => {
    setJobsSortByVisit((prev) => {
      const current = prev[visitId] ?? { key: "job" as const, dir: "asc" as const };
      if (current.key === key) {
        return { ...prev, [visitId]: { key, dir: current.dir === "asc" ? "desc" : "asc" } };
      }
      return { ...prev, [visitId]: { key, dir: "asc" } };
    });
  };

  return (
    <>
      <div className="space-y-2 md:hidden">
        {isLoading ? Array.from({ length: 3 }, (_, index) => <MobileSkeleton key={index} />) : null}
        {!isLoading && visits.length === 0 ? (
          <EmptyState
            message={emptyMessage ?? t("car.noServiceRecordsFound")}
            onClear={onClearEmpty}
          />
        ) : null}
        {visits.map((visit) => {
          const expanded = expandedVisitIds.has(visit.id);
          const vehicleName = vehicleNames.get(visit.vehicle_id) ?? "-";
          return (
            <article
              key={visit.id}
              className={`analytics-panel overflow-hidden rounded-[10px] border bg-card/80 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] ${
                expanded ? "border-primary/45" : "border-border/70"
              }`}
            >
              <button
                type="button"
                onClick={() => onToggleExpanded(visit.id)}
                aria-expanded={expanded}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-3 text-left transition-colors hover:bg-secondary/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-primary">{formatDate(visit.service_date)}</span>
                    {visit.is_annual_service ? (
                      <HistoryBadge tone="primary" icon={<WrenchIcon />}>
                        {t("car.annualServiceShort")}
                      </HistoryBadge>
                    ) : null}
                    {visit.notes?.trim() ? (
                      <HistoryBadge icon={<NoteIcon />}>{t("car.noteLabel")}</HistoryBadge>
                    ) : null}
                  </span>
                  <span className="mt-1.5 block truncate text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {vehicleName} · {visit.workshop ?? "-"}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-bold tabular-nums text-foreground">
                    {formatCurrency(Number(visit.total_amount))}
                  </span>
                  <span className="mt-1.5 block text-[10px] text-primary" aria-hidden="true">
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
                <div className="space-y-3 border-t border-primary/20 bg-background/35 p-3">
                  <FinancialSummary visit={visit} />

                  {visit.notes?.trim() ? (
                    <div className="rounded-md border border-border/50 bg-secondary/20 p-3 text-[11px] text-muted-foreground">
                      <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-primary">
                        {t("car.noteLabel")}
                      </div>
                      <div className="text-foreground">{visit.notes.trim()}</div>
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-1.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      {t("car.serviceJobs")}
                    </div>
                    <div className="space-y-1">
                      {visit.jobs.length === 0 ? (
                        <div className="py-2 text-[10px] uppercase text-muted-foreground">
                          {t("car.noJobDetails")}
                        </div>
                      ) : (
                        visit.jobs.map((job) => (
                          <div
                            key={job.id}
                            className="rounded-md px-2 py-2 text-[11px] odd:bg-secondary/20"
                          >
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                              <span className="min-w-0">
                                <span className="block truncate text-foreground">
                                  {job.job_name_snapshot}
                                </span>
                                <span className="mt-0.5 block truncate text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                                  {job.category_snapshot ?? "-"} · {t("car.qty")} {job.quantity}
                                </span>
                              </span>
                              <span className="tabular-nums text-foreground">
                                {formatCurrency(
                                  Number(job.line_total_ex_vat) * (1 + Number(visit.vat_rate)),
                                )}
                              </span>
                            </div>
                            {job.notes?.trim() ? (
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                {job.notes.trim()}
                              </div>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <VisitEditLink
                    visitId={visit.id}
                    serviceDate={visit.service_date}
                    selectedVehicleId={selectedVehicleId}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-primary/35 px-3 text-[10px] uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="hidden md:block">
        <TerminalTable variant="panel" className="font-mono text-[11px]">
          <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 text-left">{t("car.date")}</th>
              {showVehicle ? (
                <th className="px-3 py-2.5 text-left">{t("car.vehicleScope")}</th>
              ) : null}
              <th className="px-3 py-2.5 text-right">{t("car.km")}</th>
              <th className="px-3 py-2.5 text-left">{t("car.garage")}</th>
              <th className="px-3 py-2.5 text-right">{t("car.jobsCount")}</th>
              <th className="px-3 py-2.5 text-right">{t("car.total")}</th>
              <th className="w-24 px-2 py-2.5 text-right">{t("car.indicators")}</th>
              <th className="w-20 px-2 py-2.5 text-right">{t("car.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }, (_, index) => (
                <DesktopSkeletonRow key={index} columnCount={columnCount} />
              ))
            ) : visits.length === 0 ? (
              <tr className="border-t border-border/60">
                <td colSpan={columnCount} className="p-0">
                  <EmptyState
                    message={emptyMessage ?? t("car.noServiceRecordsFound")}
                    onClear={onClearEmpty}
                    embedded
                  />
                </td>
              </tr>
            ) : (
              visits.map((visit, index) => {
                const expanded = expandedVisitIds.has(visit.id);
                const sort = jobsSortByVisit[visit.id] ?? {
                  key: "job" as const,
                  dir: "asc" as const,
                };
                const sortedJobs = expanded
                  ? [...visit.jobs].sort((left, right) =>
                      compareJobs(left, right, sort.key, sort.dir, Number(visit.vat_rate)),
                    )
                  : visit.jobs;
                const collapsedTone = index % 2 === 0 ? "bg-transparent" : "bg-secondary/10";

                return (
                  <Fragment key={visit.id}>
                    {index > 0 ? (
                      <tr aria-hidden="true" className="border-0 bg-background">
                        <td colSpan={columnCount} className="h-2 p-0" />
                      </tr>
                    ) : null}
                    <tr
                      onClick={() => onToggleExpanded(visit.id)}
                      className={`cursor-pointer border-t transition-colors ${
                        expanded
                          ? "border-primary/40 bg-primary/5 text-foreground/90 shadow-[inset_3px_0_0_0_rgba(255,153,0,0.75)]"
                          : `border-border/60 text-foreground/80 hover:bg-secondary/20 ${collapsedTone}`
                      }`}
                    >
                      <td className="px-3 py-2.5 text-left font-normal">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleExpanded(visit.id);
                          }}
                          className="inline-flex items-center gap-2 rounded-sm text-left text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          aria-expanded={expanded}
                          aria-label={expanded ? t("car.collapseDetails") : t("car.expandDetails")}
                        >
                          <span className="text-[9px] text-primary" aria-hidden="true">
                            {expanded ? "▼" : "▶"}
                          </span>
                          <span>{formatDate(visit.service_date)}</span>
                        </button>
                      </td>
                      {showVehicle ? (
                        <td className="max-w-40 truncate px-3 py-2.5 text-left font-normal">
                          {vehicleNames.get(visit.vehicle_id) ?? "-"}
                        </td>
                      ) : null}
                      <td className="px-3 py-2.5 text-right font-normal tabular-nums">
                        {formatKm(visit.odometer_km)}
                      </td>
                      <td className="max-w-48 truncate px-3 py-2.5 text-left font-normal">
                        {visit.workshop ?? "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-normal">
                        {visit.jobs.length} {t("car.jobs")}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">
                        {formatCurrency(Number(visit.total_amount))}
                      </td>
                      <td className="w-24 px-2 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {visit.notes?.trim() ? (
                            <HistoryBadge icon={<NoteIcon />} title={t("car.visitHasNote")}>
                              {t("car.noteLabel")}
                            </HistoryBadge>
                          ) : null}
                          {visit.is_annual_service ? (
                            <HistoryBadge
                              tone="primary"
                              icon={<WrenchIcon />}
                              title={t("car.annualServiceLabel")}
                            >
                              {t("car.annualServiceShort")}
                            </HistoryBadge>
                          ) : null}
                        </div>
                      </td>
                      <td className="w-20 px-2 py-2 text-right font-normal">
                        <VisitEditLink
                          visitId={visit.id}
                          serviceDate={visit.service_date}
                          selectedVehicleId={selectedVehicleId}
                          compact
                        />
                      </td>
                    </tr>

                    {expanded ? (
                      <tr className="border-t border-primary/20 bg-background/70">
                        <td colSpan={columnCount} className="px-3 py-2">
                          <div className="analytics-panel overflow-hidden rounded-lg border border-primary/25 bg-card/55 shadow-[inset_0_1px_0_rgba(255,153,0,0.08)]">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-primary/15 bg-primary/[0.025] px-4 py-2 text-[10px] uppercase tracking-[0.16em]">
                              <span className="flex items-center gap-2 text-primary">
                                <span aria-hidden="true">&gt;</span>
                                {t("car.serviceDetails")}
                              </span>
                              <span className="text-muted-foreground">
                                {formatDate(visit.service_date)} // {visit.jobs.length}{" "}
                                {t("car.jobs")}
                              </span>
                            </div>

                            <div className="space-y-3 p-3">
                              <FinancialSummary visit={visit} />

                              {visit.notes?.trim() ? (
                                <div className="rounded-md border border-border/50 bg-secondary/15 p-3 text-[11px]">
                                  <span className="mr-2 text-[9px] uppercase tracking-[0.14em] text-primary">
                                    {t("car.noteLabel")}:
                                  </span>
                                  <span className="text-foreground">{visit.notes.trim()}</span>
                                </div>
                              ) : null}

                              <div>
                                <div className="mb-2 text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                                  {t("car.serviceJobs")}
                                </div>
                                {visit.jobs.length === 0 ? (
                                  <div className="rounded-md border border-dashed border-border/60 p-4 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                                    {t("car.noJobDetails")}
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto rounded-md border border-border/50 bg-background/40">
                                    <table className="w-full text-[10px] uppercase tracking-[0.12em]">
                                      <thead className="bg-secondary/30 text-muted-foreground">
                                        <tr>
                                          <SortableJobHeader
                                            label={t("car.job")}
                                            active={sort.key === "job"}
                                            direction={sort.dir}
                                            onToggle={() => toggleJobsSort(visit.id, "job")}
                                          />
                                          <SortableJobHeader
                                            label={t("car.category")}
                                            active={sort.key === "category"}
                                            direction={sort.dir}
                                            onToggle={() => toggleJobsSort(visit.id, "category")}
                                          />
                                          <SortableJobHeader
                                            label={t("car.qty")}
                                            active={sort.key === "qty"}
                                            direction={sort.dir}
                                            align="right"
                                            onToggle={() => toggleJobsSort(visit.id, "qty")}
                                          />
                                          <SortableJobHeader
                                            label={t("car.unit")}
                                            active={sort.key === "unit"}
                                            direction={sort.dir}
                                            align="right"
                                            onToggle={() => toggleJobsSort(visit.id, "unit")}
                                          />
                                          <SortableJobHeader
                                            label={t("car.subtotal")}
                                            active={sort.key === "subtotal"}
                                            direction={sort.dir}
                                            align="right"
                                            onToggle={() => toggleJobsSort(visit.id, "subtotal")}
                                          />
                                          <SortableJobHeader
                                            label={t("car.total")}
                                            active={sort.key === "total"}
                                            direction={sort.dir}
                                            align="right"
                                            onToggle={() => toggleJobsSort(visit.id, "total")}
                                          />
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
                                            <td className="px-2 py-1.5 text-left font-normal">
                                              {job.category_snapshot ?? "-"}
                                            </td>
                                            <td className="px-2 py-1.5 text-right font-normal">
                                              {job.quantity}
                                            </td>
                                            <td className="px-2 py-1.5 text-right font-normal tabular-nums">
                                              {formatCurrency(Number(job.unit_price_ex_vat))}
                                            </td>
                                            <td className="px-2 py-1.5 text-right font-normal tabular-nums">
                                              {formatCurrency(Number(job.line_total_ex_vat))}
                                            </td>
                                            <td className="px-2 py-1.5 text-right font-normal tabular-nums">
                                              {formatCurrency(
                                                Number(job.line_total_ex_vat) *
                                                  (1 + Number(visit.vat_rate)),
                                              )}
                                            </td>
                                            <td className="max-w-64 px-2 py-1.5 text-left font-normal normal-case tracking-normal">
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

function VisitEditLink({
  visitId,
  serviceDate,
  selectedVehicleId,
  className = "",
  compact = false,
}: {
  visitId: string;
  serviceDate: string;
  selectedVehicleId: string;
  className?: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Link
      to="/car-service/$visitId"
      params={{ visitId }}
      search={{ vehicleId: selectedVehicleId, visitId }}
      onClick={(event) => {
        event.stopPropagation();
        saveHistoryContext(selectedVehicleId, visitId);
      }}
      aria-label={t("car.editVisitAction", { date: formatDate(serviceDate) })}
      className={
        className ||
        "inline-flex h-7 items-center gap-1.5 rounded-md border border-transparent px-2 text-primary transition-colors hover:border-primary/30 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      }
    >
      <EditIcon />
      <span className={compact ? "sr-only xl:not-sr-only" : ""}>{t("common.edit")}</span>
    </Link>
  );
}

function saveHistoryContext(vehicleId: string, visitId: string) {
  try {
    sessionStorage.setItem("carServiceHistoryContext", JSON.stringify({ vehicleId, visitId }));
  } catch {
    // ignore storage failures
  }
}

function HistoryBadge({
  children,
  icon,
  tone = "muted",
  title,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "muted" | "primary";
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.08em] ${
        tone === "primary"
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border/60 bg-secondary/30 text-muted-foreground"
      }`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

function FinancialSummary({ visit }: { visit: ServiceVisitWithJobs }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1 rounded-md border border-border/50 bg-secondary/10 px-3 py-2 sm:justify-end">
      <FinancialFact
        label={t("car.subtotal")}
        value={formatCurrency(Number(visit.subtotal_ex_vat))}
      />
      <FinancialFact label={t("car.vatRate")} value={formatVatRate(visit.vat_rate)} />
      <FinancialFact
        label={t("car.total")}
        value={formatCurrency(Number(visit.total_amount))}
        highlight
      />
    </div>
  );
}

function FinancialFact({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <strong
        className={`text-[10px] font-semibold tabular-nums ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </strong>
    </span>
  );
}

function SortableJobHeader({
  label,
  active,
  direction,
  onToggle,
  align = "left",
}: {
  label: string;
  active: boolean;
  direction: JobsSortDirection;
  onToggle: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={align === "right" ? "px-2 py-2 text-right" : "px-2 py-2 text-left"}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        <span>{label}</span>
        <span className={active ? "text-primary" : "text-border"} aria-hidden="true">
          {active ? (direction === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function compareJobs(
  left: ServiceVisitWithJobs["jobs"][number],
  right: ServiceVisitWithJobs["jobs"][number],
  key: JobsSortKey,
  direction: JobsSortDirection,
  vatRate: number,
) {
  const factor = direction === "asc" ? 1 : -1;
  switch (key) {
    case "job":
      return left.job_name_snapshot.localeCompare(right.job_name_snapshot) * factor;
    case "category":
      return (left.category_snapshot ?? "").localeCompare(right.category_snapshot ?? "") * factor;
    case "qty":
      return (Number(left.quantity) - Number(right.quantity)) * factor;
    case "unit":
      return (Number(left.unit_price_ex_vat) - Number(right.unit_price_ex_vat)) * factor;
    case "subtotal":
      return (Number(left.line_total_ex_vat) - Number(right.line_total_ex_vat)) * factor;
    case "total":
      return (
        (Number(left.line_total_ex_vat) * (1 + vatRate) -
          Number(right.line_total_ex_vat) * (1 + vatRate)) *
        factor
      );
  }
}

function formatVatRate(rate: number) {
  return `${Math.round(Number(rate) * 10_000) / 100}%`;
}

function EmptyState({
  message,
  onClear,
  embedded = false,
}: {
  message: string;
  onClear?: () => void;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`text-center ${
        embedded
          ? "bg-card/40 px-6 py-10"
          : "rounded-[10px] border border-dashed border-border/70 bg-card/70 px-6 py-10"
      }`}
    >
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{message}</div>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-3 rounded-md border border-primary/30 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {t("car.clearAndShowAll")}
        </button>
      ) : null}
    </div>
  );
}

function MobileSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[10px] border border-border/70 bg-card/70">
      <div className="flex items-center justify-between p-3">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-secondary/70" />
          <div className="h-2.5 w-40 rounded bg-secondary/50" />
        </div>
        <div className="h-3 w-16 rounded bg-secondary/60" />
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-border/50 bg-border/50">
        <div className="h-10 bg-card/70" />
        <div className="h-10 bg-card/70" />
      </div>
    </div>
  );
}

function DesktopSkeletonRow({ columnCount }: { columnCount: number }) {
  return (
    <tr className="border-t border-border/60">
      {Array.from({ length: columnCount }, (_, index) => (
        <td key={index} className="px-3 py-3">
          <div
            className={`h-2.5 animate-pulse rounded bg-secondary/55 ${
              index === 0 ? "w-24" : index % 2 === 0 ? "ml-auto w-16" : "w-20"
            }`}
          />
        </td>
      ))}
    </tr>
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
