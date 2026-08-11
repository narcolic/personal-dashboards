import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { computeAnnualServiceStatus } from "@/routes/_authenticated/car-service/utils/carServiceUtils";

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
  const { vehicles, error, refetch } = useVehicles();
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
    <div className="space-y-4 font-mono">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onAddVehicle}
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-[0.14em] text-primary-foreground shadow-[0_10px_28px_-16px_var(--color-primary)] transition-all hover:-translate-y-0.5 hover:opacity-90"
        >
          {t("car.addVehicle")}
        </button>
      </div>

      <div>
        {error ? (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[11px] text-destructive">
            {error}
          </div>
        ) : null}
        {inlineError ? (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[11px] text-destructive">
            {inlineError}
          </div>
        ) : null}

        <div className="space-y-2">
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
            <div className="analytics-panel rounded-[10px] border border-primary/35 bg-card/70 p-4 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]">
              <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-primary">
                {t("car.addVehicle")}
              </div>
              <VehicleDetailsForm state={newVehicleForm} onChange={setNewVehicleForm} />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => void saveNewVehicle()}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground"
                >
                  {t("common.save")}
                </button>
                <button
                  onClick={() => {
                    setExpandedVehicleId(null);
                    setNewVehicleForm(null);
                  }}
                  className="inline-flex h-9 items-center rounded-md border border-border/70 px-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
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

  const rowTitle = `${(vehicle.make ?? "-").toUpperCase()} ${(vehicle.model ?? "-").toUpperCase()} · ${vehicle.year ?? "-"} · ${(vehicle.plate ?? "-").toUpperCase()}`;
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
    <div
      className={`analytics-panel overflow-hidden rounded-[10px] border bg-card/70 shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)] ${isExpanded ? "border-primary/40" : "border-border/70"}`}
    >
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={onExpand}
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="text-[10px] text-muted-foreground">{isExpanded ? "▼" : "▶"}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground">
              {rowTitle}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
              <span>{t("car.visitsCount", { count: visitCount })}</span>
              <ReminderStatusBadge status={primaryStatus} />
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
          className="inline-flex h-8 items-center rounded-md px-2 text-[10px] uppercase text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
        >
          {t("car.vehiclesLabels.delete")}
        </button>
      </div>

      {isExpanded ? (
        <div className="border-t border-primary/20 bg-background/25 p-3 md:p-4">
          {error ? <div className="mb-2 text-[11px] text-destructive">{error}</div> : null}

          <SectionHeader title={t("car.details")} />
          {isEditingDetails ? (
            <div className="mt-2 rounded-lg border border-border/70 bg-card/70 p-3">
              <VehicleDetailsForm state={details} onChange={setDetails} />
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => void saveDetails()}
                  className="text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
                >
                  [{t("common.save").toUpperCase()}]
                </button>
                <button
                  onClick={() => setIsEditingDetails(false)}
                  className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:underline"
                >
                  [{t("common.cancel").toUpperCase()}]
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-1 rounded-lg bg-secondary/15 p-3 text-[11px] text-foreground sm:grid-cols-3">
              <div>
                {t("car.colour")}: {meta.colour || "-"}
              </div>
              <div>
                {t("portfolio.notes")}: {meta.notes || "-"}
              </div>
              <div>
                {t("car.annualServiceInterval")}: {meta.annualServiceIntervalKm} km /{" "}
                {meta.annualServiceIntervalMonths} mo
              </div>
              <button
                onClick={() => setIsEditingDetails(true)}
                className="mt-2 text-left text-[10px] uppercase tracking-[0.14em] text-primary hover:underline sm:col-span-3"
              >
                {t("car.editDetails")}
              </button>
            </div>
          )}

          <SectionHeader title={t("car.serviceIntervals")} />
          <div className="space-y-2 md:hidden">
            {serviceReminders.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 p-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("car.noIntervalsConfigured")}
              </div>
            ) : (
              serviceReminders.map((reminder) => (
                <ServiceIntervalCard
                  key={reminder.id}
                  reminder={reminder}
                  onEdit={() => editReminder(reminder)}
                  onDelete={() => requestDeleteReminder(reminder)}
                />
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto rounded-lg border border-border/70 md:block">
            <table className="w-full text-[11px]">
              <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left">{t("car.intervalStatus")}</th>
                  <th className="px-2 py-1 text-left">{t("car.intervalJob")}</th>
                  <th className="px-2 py-1 text-left">{t("car.intervalRule")}</th>
                  <th className="px-2 py-1 text-left">{t("car.lastDone")}</th>
                  <th className="px-2 py-1 text-left">{t("car.remaining")}</th>
                  <th className="px-2 py-1 text-right">{t("car.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {serviceReminders.length === 0 ? (
                  <tr>
                    <td
                      className="px-2 py-2 text-muted-foreground uppercase tracking-[0.2em]"
                      colSpan={6}
                    >
                      {t("car.noIntervalsConfigured")}
                    </td>
                  </tr>
                ) : (
                  serviceReminders.map((reminder) => (
                    <ServiceIntervalRow
                      key={reminder.id}
                      reminder={reminder}
                      onEdit={() => editReminder(reminder)}
                      onDelete={async () => requestDeleteReminder(reminder)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {intervalForm ? (
            <div className="mt-3 rounded-lg border border-primary/25 bg-card/70 p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  <span>{t("car.vehiclesLabels.jobName")}</span>
                  <TerminalSelect
                    value={intervalForm.job_name}
                    onChange={(value) =>
                      setIntervalForm((prev) => (prev ? { ...prev, job_name: value } : prev))
                    }
                    ariaLabel={t("car.vehiclesLabels.jobName")}
                    options={[
                      { value: "", label: t("car.vehiclesLabels.selectJob") },
                      ...jobNames.map((name) => ({ value: name, label: name })),
                    ]}
                    className="mt-1 normal-case tracking-normal"
                    size="sm"
                  />
                </div>
                <SmallField
                  label={t("car.vehiclesLabels.intervalKm")}
                  value={intervalForm.interval_km}
                  onChange={(value) =>
                    setIntervalForm((prev) => (prev ? { ...prev, interval_km: value } : prev))
                  }
                />
                <SmallField
                  label={t("car.vehiclesLabels.intervalMonths")}
                  value={intervalForm.interval_months}
                  onChange={(value) =>
                    setIntervalForm((prev) => (prev ? { ...prev, interval_months: value } : prev))
                  }
                />
                <SmallField
                  label={t("car.vehiclesLabels.warningKm")}
                  value={intervalForm.warning_km}
                  onChange={(value) =>
                    setIntervalForm((prev) => (prev ? { ...prev, warning_km: value } : prev))
                  }
                />
                <SmallField
                  label={t("car.vehiclesLabels.warningDays")}
                  value={intervalForm.warning_days}
                  onChange={(value) =>
                    setIntervalForm((prev) => (prev ? { ...prev, warning_days: value } : prev))
                  }
                />
                <label className="md:col-span-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {t("car.editor.notes")}
                  <input
                    value={intervalForm.notes}
                    onChange={(e) =>
                      setIntervalForm((prev) => (prev ? { ...prev, notes: e.target.value } : prev))
                    }
                    className="mt-1 w-full border border-border bg-input px-2 py-1"
                  />
                </label>
              </div>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => void saveInterval()}
                  className="text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
                >
                  [{t("common.save").toUpperCase()}]
                </button>
                <button
                  onClick={() => {
                    setIntervalForm(null);
                    setEditingIntervalId(null);
                  }}
                  className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:underline"
                >
                  [{t("common.cancel").toUpperCase()}]
                </button>
              </div>
            </div>
          ) : (
            <button
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
              className="mt-2 text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
            >
              [{t("car.addInterval")}]
            </button>
          )}
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
}: {
  reminder: ServiceReminderWithStatus;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <tr className="border-t border-border/60">
      <td className="px-2 py-1">
        <ReminderStatusBadge status={reminder.status} />
      </td>
      <td className="px-2 py-1">{reminder.job_name}</td>
      <td className="px-2 py-1">
        {reminder.interval_km ? `${reminder.interval_km}km` : "-"}{" "}
        {reminder.interval_months ? `/${reminder.interval_months}mo` : ""}
      </td>
      <td className="px-2 py-1">
        {reminder.lastDoneDate ?? "--"}{" "}
        {reminder.lastDoneKm != null ? `· ${reminder.lastDoneKm}km` : ""}
      </td>
      <td className="px-2 py-1">
        {reminder.kmRemaining != null ? `${reminder.kmRemaining}km` : "--"}{" "}
        {reminder.daysRemaining != null ? `· ${reminder.daysRemaining}d` : ""}
      </td>
      <td className="px-2 py-1 text-right">
        <button onClick={onEdit} className="mr-2 text-primary">
          [{t("car.vehiclesLabels.edit")}]
        </button>
        <button onClick={() => void onDelete()} className="text-destructive">
          [×]
        </button>
      </td>
    </tr>
  );
}

function ServiceIntervalCard({
  reminder,
  onEdit,
  onDelete,
}: {
  reminder: ServiceReminderWithStatus;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <ReminderStatusBadge status={reminder.status} />
          <div className="mt-2 truncate text-sm font-semibold text-foreground">
            {reminder.job_name}
          </div>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md px-2 py-1 text-[10px] uppercase text-primary hover:bg-primary/10"
          >
            {t("car.vehiclesLabels.edit")}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md px-2 py-1 text-[10px] uppercase text-destructive hover:bg-destructive/10"
          >
            {t("car.vehiclesLabels.delete")}
          </button>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-2 text-[10px]">
        <div>
          <div className="uppercase text-muted-foreground">{t("car.intervalRule")}</div>
          <div className="mt-1 text-foreground">
            {reminder.interval_km ? `${reminder.interval_km}km` : "-"}{" "}
            {reminder.interval_months ? `/ ${reminder.interval_months}mo` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="uppercase text-muted-foreground">{t("car.remaining")}</div>
          <div className="mt-1 text-foreground">
            {reminder.kmRemaining != null ? `${reminder.kmRemaining}km` : "--"}{" "}
            {reminder.daysRemaining != null ? `· ${reminder.daysRemaining}d` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-5 mb-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      {title}
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
    <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full border border-border bg-input px-2 py-1"
      />
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
        label={t("car.make")}
        value={state.make}
        onChange={(value) => onChange({ ...state, make: value })}
      />
      <SmallField
        label={t("car.model")}
        value={state.model}
        onChange={(value) => onChange({ ...state, model: value })}
      />
      <SmallField
        label={t("car.year")}
        value={state.year}
        onChange={(value) => onChange({ ...state, year: value })}
      />
      <SmallField
        label={t("car.licensePlate")}
        value={state.plate}
        onChange={(value) => onChange({ ...state, plate: value })}
      />
      <SmallField
        label={t("car.colour")}
        value={state.colour}
        onChange={(value) => onChange({ ...state, colour: value })}
      />
      <SmallField
        label={t("car.annualServiceIntervalKm")}
        value={state.annualServiceIntervalKm}
        onChange={(value) => onChange({ ...state, annualServiceIntervalKm: value })}
      />
      <SmallField
        label={t("car.annualServiceIntervalMonths")}
        value={state.annualServiceIntervalMonths}
        onChange={(value) => onChange({ ...state, annualServiceIntervalMonths: value })}
      />
      <SmallField
        label={t("car.editor.notes")}
        value={state.notes}
        onChange={(value) => onChange({ ...state, notes: value })}
      />
    </div>
  );
}
