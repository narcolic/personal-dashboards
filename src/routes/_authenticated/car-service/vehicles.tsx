import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { useCarService } from "@/routes/_authenticated/car-service/hooks/useCarService";
import {
  createServiceReminder,
  deleteServiceReminder,
  updateServiceReminder,
} from "@/routes/_authenticated/car-service/hooks/useReminderMutations";
import { useReminders } from "@/routes/_authenticated/car-service/hooks/useReminders";
import {
  createVehicle,
  deleteVehicle,
  parseVehicleMeta,
  updateVehicle,
} from "@/routes/_authenticated/car-service/hooks/useVehicleMutations";
import { useVehicles } from "@/routes/_authenticated/car-service/hooks/useVehicles";
import { ReminderStatusBadge } from "@/routes/_authenticated/car-service/components/ReminderStatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TerminalSelect } from "@/components/ui/TerminalSelect";
import type { ServiceReminderWithStatus, Vehicle } from "@/routes/_authenticated/car-service/types";
import { useTranslation } from "react-i18next";
import {
  computeAnnualServiceStatus,
  formatKm,
} from "@/routes/_authenticated/car-service/utils/carServiceUtils";

const primaryButton =
  "inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const secondaryButton =
  "inline-flex h-10 items-center justify-center rounded-lg border border-border/70 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const textButton =
  "inline-flex items-center justify-center rounded-md px-2 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const dangerButton =
  "inline-flex items-center justify-center rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const fieldClass =
  "mt-1.5 h-11 w-full rounded-lg border border-border/70 bg-background/40 px-3 text-sm text-foreground outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30";

export const Route = createFileRoute("/_authenticated/car-service/vehicles")({
  component: VehiclesScreen,
});

type VehicleFormState = {
  make: string;
  model: string;
  year: string;
  plate: string;
  colour: string;
  notes: string;
  annualServiceIntervalKm: string;
  annualServiceIntervalMonths: string;
};

type IntervalFormState = {
  job_name: string;
  interval_km: string;
  interval_months: string;
  warning_km: string;
  warning_days: string;
  notes: string;
};

function emptyVehicleForm(): VehicleFormState {
  return {
    make: "",
    model: "",
    year: "",
    plate: "",
    colour: "",
    notes: "",
    annualServiceIntervalKm: "15000",
    annualServiceIntervalMonths: "12",
  };
}

function VehiclesScreen() {
  const { t } = useTranslation();
  const { vehicles, isLoading, error, refetch } = useVehicles();
  const { visits } = useCarService("all");
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const initialExpandedVehicleId = searchParams.get("vehicleId")?.trim() || null;
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(
    initialExpandedVehicleId,
  );
  const [newVehicleForm, setNewVehicleForm] = useState<VehicleFormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const visitCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const visit of visits) map.set(visit.vehicle_id, (map.get(visit.vehicle_id) ?? 0) + 1);
    return map;
  }, [visits]);

  const onAddVehicle = () => {
    setExpandedVehicleId("new");
    setNewVehicleForm(emptyVehicleForm());
    setInlineError(null);
  };

  const saveNewVehicle = async () => {
    if (!newVehicleForm) return;
    const make = newVehicleForm.make.trim();
    const model = newVehicleForm.model.trim();
    const plate = newVehicleForm.plate.trim();
    const year = Number(newVehicleForm.year);
    const annualServiceIntervalKm = Number(newVehicleForm.annualServiceIntervalKm);
    const annualServiceIntervalMonths = Number(newVehicleForm.annualServiceIntervalMonths);

    if (!make || !model || !plate || !Number.isFinite(year)) {
      setInlineError(t("car.vehicleRequired"));
      return;
    }
    if (
      !Number.isFinite(annualServiceIntervalKm) ||
      annualServiceIntervalKm <= 0 ||
      !Number.isFinite(annualServiceIntervalMonths) ||
      annualServiceIntervalMonths <= 0
    ) {
      setInlineError(t("car.annualServiceIntervalRequired"));
      return;
    }

    setBusy(true);
    setInlineError(null);
    try {
      await createVehicle({
        ...newVehicleForm,
        make,
        model,
        plate,
        year,
        annualServiceIntervalKm,
        annualServiceIntervalMonths,
      });
      await refetch();
      setExpandedVehicleId(null);
      setNewVehicleForm(null);
    } catch (e) {
      setInlineError(e instanceof Error ? e.message : t("car.failedSaveVehicle"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 font-analytics">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t("car.vehiclePage.title")}</h1>
        <button type="button" onClick={onAddVehicle} disabled={busy} className={primaryButton}>
          {t("car.vehiclePage.addVehicle")}
        </button>
      </div>

      <div>
        {error ? (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {inlineError ? (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {inlineError}
          </div>
        ) : null}

        <div className="space-y-4">
          {isLoading && vehicles.length === 0 ? (
            <div
              className="h-24 animate-pulse rounded-[10px] border border-border/70 bg-card/70"
              aria-label={t("common.loading")}
            />
          ) : !error && vehicles.length === 0 && !newVehicleForm ? (
            <div className="rounded-[10px] border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
              {t("car.vehiclePage.noVehicles")}
            </div>
          ) : null}
          {vehicles.map((vehicle) => (
            <VehicleAccordionItem
              key={vehicle.id}
              vehicle={vehicle}
              isExpanded={expandedVehicleId === vehicle.id}
              visitCount={visitCounts.get(vehicle.id) ?? 0}
              visits={visits}
              busy={busy}
              onExpand={() =>
                setExpandedVehicleId((prev) => (prev === vehicle.id ? null : vehicle.id))
              }
              onBusyChange={setBusy}
              onError={setInlineError}
              onMutated={refetch}
            />
          ))}

          {expandedVehicleId === "new" && newVehicleForm ? (
            <div className="rounded-[10px] border border-border/70 bg-card/80 p-5">
              <div className="mb-4 text-base font-semibold text-foreground">
                {t("car.vehiclePage.addVehicle")}
              </div>
              <VehicleDetailsForm state={newVehicleForm} onChange={setNewVehicleForm} />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => void saveNewVehicle()}
                  disabled={busy}
                  className={primaryButton}
                >
                  {t("common.save")}
                </button>
                <button
                  onClick={() => {
                    setExpandedVehicleId(null);
                    setNewVehicleForm(null);
                  }}
                  disabled={busy}
                  className={secondaryButton}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function VehicleAccordionItem({
  vehicle,
  visits,
  visitCount,
  isExpanded,
  busy,
  onExpand,
  onBusyChange,
  onError,
  onMutated,
}: {
  vehicle: Vehicle;
  visits: ReturnType<typeof useCarService>["visits"];
  visitCount: number;
  isExpanded: boolean;
  busy: boolean;
  onExpand: () => void;
  onBusyChange: (busy: boolean) => void;
  onError: (value: string | null) => void;
  onMutated: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const meta = parseVehicleMeta(vehicle.name);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [details, setDetails] = useState<VehicleFormState>({
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    year: vehicle.year ? String(vehicle.year) : "",
    plate: vehicle.plate ?? "",
    colour: meta.colour,
    notes: meta.notes,
    annualServiceIntervalKm: String(meta.annualServiceIntervalKm),
    annualServiceIntervalMonths: String(meta.annualServiceIntervalMonths),
  });
  const [intervalForm, setIntervalForm] = useState<IntervalFormState | null>(null);
  const [editingIntervalId, setEditingIntervalId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    isConfirming: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const { serviceReminders, error, refetch } = useReminders(vehicle.id);
  const vehicleVisits = useMemo(
    () => visits.filter((v) => v.vehicle_id === vehicle.id),
    [visits, vehicle.id],
  );
  const jobNames = useMemo(
    () =>
      Array.from(
        new Set(
          vehicleVisits.flatMap((visit) =>
            visit.jobs.map((job) => job.job_name_snapshot.trim()).filter(Boolean),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [vehicleVisits],
  );

  const rowTitle = `${vehicle.make ?? "-"} ${vehicle.model ?? "-"}`.trim();
  const primaryReminder = [...serviceReminders].sort((left, right) => {
    const priority = { OVERDUE: 0, "DUE SOON": 1, OK: 2, "NO DATA": 3 } as const;
    return priority[left.status] - priority[right.status];
  })[0];
  const currentKm = vehicleVisits.reduce(
    (highest, visit) => Math.max(highest, Number(visit.odometer_km)),
    0,
  );
  const annualServiceStatus = computeAnnualServiceStatus(
    vehicleVisits,
    currentKm,
    meta.annualServiceIntervalKm,
    meta.annualServiceIntervalMonths,
  ).status;
  const statusPriority = { OVERDUE: 0, "DUE SOON": 1, OK: 2, "NO DATA": 3 } as const;
  const primaryStatus =
    primaryReminder && statusPriority[primaryReminder.status] < statusPriority[annualServiceStatus]
      ? primaryReminder.status
      : annualServiceStatus;

  const saveDetails = async () => {
    const make = details.make.trim();
    const model = details.model.trim();
    const plate = details.plate.trim();
    const year = Number(details.year);
    const annualServiceIntervalKm = Number(details.annualServiceIntervalKm);
    const annualServiceIntervalMonths = Number(details.annualServiceIntervalMonths);
    if (!make || !model || !plate || !Number.isFinite(year)) {
      onError(t("car.vehicleRequired"));
      return;
    }
    if (
      !Number.isFinite(annualServiceIntervalKm) ||
      annualServiceIntervalKm <= 0 ||
      !Number.isFinite(annualServiceIntervalMonths) ||
      annualServiceIntervalMonths <= 0
    ) {
      onError(t("car.annualServiceIntervalRequired"));
      return;
    }

    onBusyChange(true);
    onError(null);
    try {
      await updateVehicle(vehicle.id, {
        ...details,
        make,
        model,
        plate,
        year,
        annualServiceIntervalKm,
        annualServiceIntervalMonths,
      });
      await onMutated();
      setIsEditingDetails(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : t("car.failedSaveVehicle"));
    } finally {
      onBusyChange(false);
    }
  };

  const removeVehicle = async () => {
    if (visitCount > 0) {
      onError(t("car.cannotDeleteLinked", { count: visitCount }));
      return;
    }
    onBusyChange(true);
    onError(null);
    try {
      await deleteVehicle(vehicle.id);
      await onMutated();
    } catch (e) {
      onError(e instanceof Error ? e.message : t("car.failedDeleteVehicle"));
    } finally {
      onBusyChange(false);
    }
  };

  const saveInterval = async () => {
    if (!intervalForm) return;
    if (!intervalForm.job_name.trim()) return onError(t("car.jobNameRequired"));
    if (!intervalForm.interval_km && !intervalForm.interval_months) {
      return onError(t("car.intervalRequired"));
    }

    const payload = {
      vehicle_id: vehicle.id,
      job_name: intervalForm.job_name.trim(),
      interval_km: intervalForm.interval_km ? Number(intervalForm.interval_km) : null,
      interval_months: intervalForm.interval_months ? Number(intervalForm.interval_months) : null,
      warning_km: intervalForm.warning_km ? Number(intervalForm.warning_km) : 500,
      warning_days: intervalForm.warning_days ? Number(intervalForm.warning_days) : 30,
      notes: intervalForm.notes.trim() || null,
      is_active: true,
    };

    onBusyChange(true);
    onError(null);
    try {
      if (editingIntervalId) await updateServiceReminder(editingIntervalId, payload);
      else await createServiceReminder(payload);

      await refetch();
      setIntervalForm(null);
      setEditingIntervalId(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : t("car.failedSaveReminder"));
    } finally {
      onBusyChange(false);
    }
  };

  const editReminder = (reminder: ServiceReminderWithStatus) => {
    setEditingIntervalId(reminder.id);
    setIntervalForm({
      job_name: reminder.job_name,
      interval_km: reminder.interval_km ? String(reminder.interval_km) : "",
      interval_months: reminder.interval_months ? String(reminder.interval_months) : "",
      warning_km: reminder.warning_km ? String(reminder.warning_km) : "500",
      warning_days: reminder.warning_days ? String(reminder.warning_days) : "30",
      notes: reminder.notes ?? "",
    });
  };

  const requestDeleteReminder = (reminder: ServiceReminderWithStatus) => {
    setDeleteDialog({
      title: t("common.delete"),
      description: t("car.deleteIntervalConfirm", { job: reminder.job_name }),
      confirmLabel: t("common.delete"),
      isConfirming: false,
      onConfirm: async () => {
        await deleteServiceReminder(reminder.id);
        await refetch();
      },
    });
  };

  return (
    <div className="overflow-hidden rounded-[10px] border border-border/70 bg-card/80">
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? `vehicle-details-${vehicle.id}` : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${isExpanded ? "rotate-90 text-primary" : ""}`}
          >
            <path d="m6 3 5 5-5 5" />
          </svg>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-lg font-semibold tracking-tight text-foreground">
              {rowTitle}
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {vehicle.year ? <span>{vehicle.year}</span> : null}
              {vehicle.plate ? (
                <span className="rounded-md border border-border/70 px-2 py-1 font-mono text-[11px] font-medium text-foreground/80">
                  {vehicle.plate}
                </span>
              ) : null}
              <span>{t("car.vehiclePage.visits", { count: visitCount })}</span>
              <ReminderStatusBadge status={primaryStatus} variant="readable" />
            </span>
          </span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDeleteDialog({
              title: t("common.delete"),
              description: t("car.deleteVehicleConfirm", { vehicle: rowTitle }),
              confirmLabel: t("common.delete"),
              isConfirming: false,
              onConfirm: removeVehicle,
            });
          }}
          disabled={busy}
          className={dangerButton}
        >
          {t("car.vehiclePage.delete")}
        </button>
      </div>

      {isExpanded ? (
        <div
          id={`vehicle-details-${vehicle.id}`}
          className="space-y-6 border-t border-border/60 p-4 sm:p-5"
        >
          {error ? <div className="mb-2 text-sm text-destructive">{error}</div> : null}

          <SectionHeader
            title={t("car.vehiclePage.details")}
            action={
              !isEditingDetails ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setIsEditingDetails(true)}
                  className={textButton}
                >
                  {t("car.vehiclePage.editDetails")}
                </button>
              ) : undefined
            }
          />
          {isEditingDetails ? (
            <div className="mt-2 rounded-lg border border-border/70 bg-card/70 p-3">
              <VehicleDetailsForm state={details} onChange={setDetails} />
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => void saveDetails()}
                  disabled={busy}
                  className={primaryButton}
                >
                  {t("common.save")}
                </button>
                <button
                  onClick={() => setIsEditingDetails(false)}
                  disabled={busy}
                  className={secondaryButton}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          ) : (
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">{t("car.vehiclePage.colour")}</dt>
                <dd className="mt-1 text-sm font-medium">{meta.colour || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {t("car.vehiclePage.annualInterval")}
                </dt>
                <dd className="mt-1 text-sm font-medium tabular-nums">
                  {formatKm(meta.annualServiceIntervalKm)} ·{" "}
                  {t("car.vehiclePage.months", { count: meta.annualServiceIntervalMonths })}
                </dd>
              </div>
              {meta.notes.trim() ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">{t("portfolio.notes")}</dt>
                  <dd className="mt-1 break-words text-sm text-foreground/90">{meta.notes}</dd>
                </div>
              ) : null}
            </dl>
          )}

          <div className="space-y-3 border-t border-border/50 pt-5">
            <SectionHeader
              title={t("car.vehiclePage.intervals")}
              action={
                !intervalForm ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      setIntervalForm({
                        job_name: "",
                        interval_km: "",
                        interval_months: "",
                        warning_km: "500",
                        warning_days: "30",
                        notes: "",
                      })
                    }
                    className={textButton}
                  >
                    {t("car.vehiclePage.addInterval")}
                  </button>
                ) : undefined
              }
            />
            <div className="space-y-2 md:hidden">
              {serviceReminders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  {t("car.vehiclePage.noIntervals")}
                </div>
              ) : (
                serviceReminders.map((reminder) => (
                  <ServiceIntervalCard
                    key={reminder.id}
                    reminder={reminder}
                    busy={busy}
                    onEdit={() => editReminder(reminder)}
                    onDelete={() => requestDeleteReminder(reminder)}
                  />
                ))
              )}
            </div>
            <div className="hidden overflow-x-auto rounded-lg border border-border/70 md:block">
              <table className="w-full text-sm">
                <thead className="bg-secondary/20 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium">
                      {t("car.vehiclePage.status")}
                    </th>
                    <th className="px-3 py-3 text-left font-medium">{t("car.vehiclePage.job")}</th>
                    <th className="px-3 py-3 text-left font-medium">{t("car.vehiclePage.rule")}</th>
                    <th className="px-3 py-3 text-left font-medium">
                      {t("car.vehiclePage.lastDone")}
                    </th>
                    <th className="px-3 py-3 text-left font-medium">
                      {t("car.vehiclePage.remaining")}
                    </th>
                    <th className="px-3 py-3 text-right font-medium">
                      {t("car.vehiclePage.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {serviceReminders.length === 0 ? (
                    <tr>
                      <td className="px-4 py-5 text-sm text-muted-foreground" colSpan={6}>
                        {t("car.vehiclePage.noIntervals")}
                      </td>
                    </tr>
                  ) : (
                    serviceReminders.map((reminder) => (
                      <ServiceIntervalRow
                        key={reminder.id}
                        reminder={reminder}
                        busy={busy}
                        onEdit={() => editReminder(reminder)}
                        onDelete={() => requestDeleteReminder(reminder)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {intervalForm ? (
              <div className="rounded-lg border border-border/70 bg-secondary/10 p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="block text-xs font-medium text-muted-foreground">
                    <span>{t("car.vehiclePage.job")}</span>
                    <TerminalSelect
                      value={intervalForm.job_name}
                      onChange={(value) =>
                        setIntervalForm((prev) => (prev ? { ...prev, job_name: value } : prev))
                      }
                      ariaLabel={t("car.vehiclePage.job")}
                      options={[
                        { value: "", label: t("car.vehiclePage.selectJob") },
                        ...jobNames.map((name) => ({ value: name, label: name })),
                      ]}
                      className="mt-1.5"
                      modern
                      disabled={busy}
                    />
                  </div>
                  <SmallField
                    label={t("car.vehiclePage.intervalKm")}
                    value={intervalForm.interval_km}
                    onChange={(value) =>
                      setIntervalForm((prev) => (prev ? { ...prev, interval_km: value } : prev))
                    }
                  />
                  <SmallField
                    label={t("car.vehiclePage.intervalMonths")}
                    value={intervalForm.interval_months}
                    onChange={(value) =>
                      setIntervalForm((prev) => (prev ? { ...prev, interval_months: value } : prev))
                    }
                  />
                  <SmallField
                    label={t("car.vehiclePage.warningKm")}
                    value={intervalForm.warning_km}
                    onChange={(value) =>
                      setIntervalForm((prev) => (prev ? { ...prev, warning_km: value } : prev))
                    }
                  />
                  <SmallField
                    label={t("car.vehiclePage.warningDays")}
                    value={intervalForm.warning_days}
                    onChange={(value) =>
                      setIntervalForm((prev) => (prev ? { ...prev, warning_days: value } : prev))
                    }
                  />
                  <label className="md:col-span-2 text-xs font-medium text-muted-foreground">
                    {t("portfolio.notes")}
                    <input
                      value={intervalForm.notes}
                      onChange={(e) =>
                        setIntervalForm((prev) =>
                          prev ? { ...prev, notes: e.target.value } : prev,
                        )
                      }
                      className={fieldClass}
                    />
                  </label>
                </div>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={() => void saveInterval()}
                    disabled={busy}
                    className={primaryButton}
                  >
                    {t("common.save")}
                  </button>
                  <button
                    onClick={() => {
                      setIntervalForm(null);
                      setEditingIntervalId(null);
                    }}
                    disabled={busy}
                    className={secondaryButton}
                  >
                    {t("common.cancel")}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={deleteDialog != null}
        title={deleteDialog?.title ?? t("common.delete")}
        description={deleteDialog?.description ?? ""}
        confirmLabel={deleteDialog?.confirmLabel ?? t("common.delete")}
        isConfirming={busy || deleteDialog?.isConfirming || false}
        onCancel={() => setDeleteDialog(null)}
        onConfirm={() => {
          if (!deleteDialog) return;
          void deleteDialog.onConfirm().then(() => setDeleteDialog(null));
        }}
      />
    </div>
  );
}

function ServiceIntervalRow({
  reminder,
  onEdit,
  onDelete,
  busy,
}: {
  reminder: ServiceReminderWithStatus;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <tr className="border-t border-border/60 transition-colors hover:bg-secondary/15">
      <td className="px-3 py-4">
        <ReminderStatusBadge status={reminder.status} variant="readable" />
      </td>
      <td className="px-3 py-4 font-medium">{reminder.job_name}</td>
      <td className="px-3 py-4">
        <IntervalValues reminder={reminder} kind="rule" />
      </td>
      <td className="px-3 py-4">
        <IntervalValues reminder={reminder} kind="lastDone" />
      </td>
      <td className="px-3 py-4">
        <IntervalValues reminder={reminder} kind="remaining" />
      </td>
      <td className="px-3 py-4 text-right">
        <IntervalActions reminder={reminder} onEdit={onEdit} onDelete={onDelete} busy={busy} />
      </td>
    </tr>
  );
}

function ServiceIntervalCard({
  reminder,
  onEdit,
  onDelete,
  busy,
}: {
  reminder: ServiceReminderWithStatus;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border/70 bg-secondary/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="break-words text-sm font-semibold">{reminder.job_name}</h3>
        <ReminderStatusBadge status={reminder.status} variant="readable" />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <dt className="mb-1 text-xs text-muted-foreground">{t("car.vehiclePage.rule")}</dt>
          <dd>
            <IntervalValues reminder={reminder} kind="rule" />
          </dd>
        </div>
        <div>
          <dt className="mb-1 text-xs text-muted-foreground">{t("car.vehiclePage.remaining")}</dt>
          <dd>
            <IntervalValues reminder={reminder} kind="remaining" />
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="mb-1 text-xs text-muted-foreground">{t("car.vehiclePage.lastDone")}</dt>
          <dd>
            <IntervalValues reminder={reminder} kind="lastDone" />
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex justify-end border-t border-border/50 pt-2">
        <IntervalActions reminder={reminder} onEdit={onEdit} onDelete={onDelete} busy={busy} />
      </div>
    </div>
  );
}

function IntervalActions({
  reminder,
  onEdit,
  onDelete,
  busy,
}: {
  reminder: ServiceReminderWithStatus;
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex items-center gap-1 whitespace-nowrap">
      <button
        type="button"
        disabled={busy}
        onClick={onEdit}
        className={textButton}
        aria-label={t("car.vehiclePage.editInterval", { job: reminder.job_name })}
      >
        {t("car.vehiclePage.edit")}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className={dangerButton}
        aria-label={t("car.vehiclePage.deleteInterval", { job: reminder.job_name })}
      >
        {t("common.delete")}
      </button>
    </div>
  );
}

function IntervalValues({
  reminder,
  kind,
}: {
  reminder: ServiceReminderWithStatus;
  kind: "rule" | "lastDone" | "remaining";
}) {
  const { t, i18n } = useTranslation();
  const values: string[] = [];
  if (kind === "rule") {
    if (reminder.interval_km) values.push(formatKm(reminder.interval_km));
    if (reminder.interval_months)
      values.push(t("car.vehiclePage.months", { count: reminder.interval_months }));
  } else if (kind === "lastDone") {
    if (reminder.lastDoneDate)
      values.push(
        new Intl.DateTimeFormat(i18n.language === "el" ? "el-GR" : "en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(new Date(reminder.lastDoneDate)),
      );
    if (reminder.lastDoneKm != null) values.push(formatKm(reminder.lastDoneKm));
  } else {
    if (reminder.kmRemaining != null) values.push(formatKm(reminder.kmRemaining));
    if (reminder.daysRemaining != null)
      values.push(t("car.vehiclePage.days", { count: reminder.daysRemaining }));
  }
  return (
    <div className="space-y-1 text-sm tabular-nums">
      {values.length ? (
        values.map((value, index) => (
          <div
            key={index}
            className={index ? "text-xs text-muted-foreground" : "text-foreground/90"}
          >
            {value}
          </div>
        ))
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {action}
    </div>
  );
}

function SmallField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className={fieldClass} />
    </label>
  );
}

function VehicleDetailsForm({
  state,
  onChange,
}: {
  state: VehicleFormState;
  onChange: (next: VehicleFormState) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <SmallField
        label={t("car.vehiclePage.make")}
        value={state.make}
        onChange={(value) => onChange({ ...state, make: value })}
      />
      <SmallField
        label={t("car.vehiclePage.model")}
        value={state.model}
        onChange={(value) => onChange({ ...state, model: value })}
      />
      <SmallField
        label={t("car.vehiclePage.year")}
        value={state.year}
        onChange={(value) => onChange({ ...state, year: value })}
      />
      <SmallField
        label={t("car.vehiclePage.plate")}
        value={state.plate}
        onChange={(value) => onChange({ ...state, plate: value })}
      />
      <SmallField
        label={t("car.vehiclePage.colour")}
        value={state.colour}
        onChange={(value) => onChange({ ...state, colour: value })}
      />
      <SmallField
        label={t("car.vehiclePage.annualKm")}
        value={state.annualServiceIntervalKm}
        onChange={(value) => onChange({ ...state, annualServiceIntervalKm: value })}
      />
      <SmallField
        label={t("car.vehiclePage.annualMonths")}
        value={state.annualServiceIntervalMonths}
        onChange={(value) => onChange({ ...state, annualServiceIntervalMonths: value })}
      />
      <SmallField
        label={t("portfolio.notes")}
        value={state.notes}
        onChange={(value) => onChange({ ...state, notes: value })}
      />
    </div>
  );
}
