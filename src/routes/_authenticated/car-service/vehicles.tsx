import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCarServiceData } from "@/routes/_authenticated/car-service/hooks/useCarServiceData";
import {
  createManualReminder,
  createServiceReminder,
  deleteManualReminder,
  deleteServiceReminder,
  toggleManualReminderDone,
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
import type { ServiceReminderWithStatus, Vehicle } from "@/routes/_authenticated/car-service/types";
import { useTranslation } from "react-i18next";

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
  const { user } = useAuth();
  const { vehicles, isLoading, error, refetch } = useVehicles();
  const { visits } = useCarServiceData("all");
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
    if (!user?.id || !newVehicleForm) return;
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
      await createVehicle(supabase, user.id, {
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
      <div className="border border-border bg-card px-4 py-2">
        <div className="text-[11px] uppercase tracking-[0.2em] text-primary">
          {t("car.vehiclesTitle")}
        </div>
      </div>

      <div className="border border-border bg-card p-4">
        {error ? <div className="mb-3 text-[11px] text-destructive">{error}</div> : null}
        {inlineError ? (
          <div className="mb-3 text-[11px] text-destructive">{inlineError}</div>
        ) : null}

        <div className="space-y-2">
          {isLoading ? (
            <div className="text-[11px] text-muted-foreground">{t("common.loading")}</div>
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
            <div className="border border-border p-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-primary">
                {t("car.addVehicle")}
              </div>
              <VehicleDetailsForm state={newVehicleForm} onChange={setNewVehicleForm} />
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => void saveNewVehicle()}
                  className="text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
                >
                  [{t("common.save").toUpperCase()}]
                </button>
                <button
                  onClick={() => {
                    setExpandedVehicleId(null);
                    setNewVehicleForm(null);
                  }}
                  className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:underline"
                >
                  [{t("common.cancel").toUpperCase()}]
                </button>
              </div>
            </div>
          ) : null}

          <button
            onClick={onAddVehicle}
            className="text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
          >
            + ADD VEHICLE
          </button>
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
  visits: ReturnType<typeof useCarServiceData>["visits"];
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
  const [manualForm, setManualForm] = useState<{
    title: string;
    due_date: string;
    notes: string;
  } | null>(null);

  const { serviceReminders, manualReminders, error, refetch } = useReminders(vehicle.id);
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
      await updateVehicle(supabase, vehicle.id, {
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
      await deleteVehicle(supabase, vehicle.id);
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
      const { data } = await supabase.auth.getUser();
      if (!data.user?.id) throw new Error(t("car.authRequired"));

      if (editingIntervalId) await updateServiceReminder(supabase, editingIntervalId, payload);
      else await createServiceReminder(supabase, data.user.id, payload);

      await refetch();
      setIntervalForm(null);
      setEditingIntervalId(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : t("car.failedSaveReminder"));
    } finally {
      onBusyChange(false);
    }
  };

  const saveManualReminder = async () => {
    if (!manualForm?.title.trim()) return onError(t("car.titleRequired"));
    onBusyChange(true);
    onError(null);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user?.id) throw new Error(t("car.authRequired"));
      await createManualReminder(supabase, data.user.id, {
        vehicle_id: vehicle.id,
        title: manualForm.title.trim(),
        due_date: manualForm.due_date || null,
        notes: manualForm.notes.trim() || null,
      });
      await refetch();
      setManualForm(null);
    } catch (e) {
      onError(e instanceof Error ? e.message : t("car.failedSaveReminder"));
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <div className="border border-border">
      <div
        className="flex cursor-pointer items-center justify-between px-3 py-2"
        onClick={onExpand}
      >
        <button className="mr-2 text-muted-foreground">{isExpanded ? "\u25BC" : "\u25B6"}</button>
        <div className="flex-1 text-[11px] uppercase tracking-[0.1em]">{rowTitle}</div>
        <div className="mr-3 text-[11px] text-muted-foreground">
          {t("car.visitsCount", { count: visitCount })}
        </div>
        <div className="flex gap-2 text-[11px]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void removeVehicle();
            }}
            disabled={busy}
            className="uppercase text-destructive hover:underline disabled:opacity-50"
          >
            [{t("car.vehiclesLabels.delete")}]
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="ml-2 border-l-2 border-primary pl-4 pb-3">
          {error ? <div className="mb-2 text-[11px] text-destructive">{error}</div> : null}

          <SectionHeader title={t("car.details")} />
          {isEditingDetails ? (
            <div className="mt-2 border border-border bg-card p-3">
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
            <div className="text-[11px] text-foreground">
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
                className="mt-2 text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
              >
                [{t("car.editDetails")}]
              </button>
            </div>
          )}

          <SectionHeader title={t("car.serviceIntervals")} />
          <div className="overflow-x-auto border border-border">
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
                      onEdit={() => {
                        setEditingIntervalId(reminder.id);
                        setIntervalForm({
                          job_name: reminder.job_name,
                          interval_km: reminder.interval_km ? String(reminder.interval_km) : "",
                          interval_months: reminder.interval_months
                            ? String(reminder.interval_months)
                            : "",
                          warning_km: reminder.warning_km ? String(reminder.warning_km) : "500",
                          warning_days: reminder.warning_days
                            ? String(reminder.warning_days)
                            : "30",
                          notes: reminder.notes ?? "",
                        });
                      }}
                      onDelete={async () => {
                        await deleteServiceReminder(supabase, reminder.id);
                        await refetch();
                      }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {intervalForm ? (
            <div className="mt-2 border border-border bg-card p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {t("car.vehiclesLabels.jobName")}
                  <select
                    value={intervalForm.job_name}
                    onChange={(e) =>
                      setIntervalForm((prev) =>
                        prev ? { ...prev, job_name: e.target.value } : prev,
                      )
                    }
                    className="mt-1 w-full border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="">{t("car.vehiclesLabels.selectJob")}</option>
                    {jobNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
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

          <SectionHeader title={t("car.manualReminders")} />
          <div className="space-y-1 text-[11px]">
            {manualReminders.length === 0 ? (
              <div className="uppercase tracking-[0.2em] text-muted-foreground">
                {t("car.noReminders")}
              </div>
            ) : (
              manualReminders.map((reminder) => {
                const isPastDue =
                  !reminder.is_done &&
                  !!reminder.due_date &&
                  new Date(reminder.due_date) < new Date();
                return (
                  <div
                    key={reminder.id}
                    className={`flex items-center justify-between border-b border-border pb-1 ${reminder.is_done ? "line-through opacity-50" : ""}`}
                  >
                    <button
                      onClick={() =>
                        void toggleManualReminderDone(
                          supabase,
                          reminder.id,
                          !reminder.is_done,
                        ).then(refetch)
                      }
                    >
                      [{reminder.is_done ? "✓" : " "}]
                    </button>
                    <span className={`flex-1 px-2 ${isPastDue ? "text-destructive" : ""}`}>
                      {reminder.title} {reminder.due_date ? `· ${reminder.due_date}` : ""}{" "}
                      {reminder.notes ? "· ?" : ""}
                    </span>
                    <button
                      onClick={() => void deleteManualReminder(supabase, reminder.id).then(refetch)}
                      className="text-destructive"
                    >
                      [×]
                    </button>
                  </div>
                );
              })
            )}
          </div>
          {manualForm ? (
            <div className="mt-2 border border-border bg-card p-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <SmallField
                  label={t("car.vehiclesLabels.title")}
                  value={manualForm.title}
                  onChange={(value) =>
                    setManualForm((prev) => (prev ? { ...prev, title: value } : prev))
                  }
                />
                <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {t("car.vehiclesLabels.dueDate")}
                  <input
                    type="date"
                    value={manualForm.due_date}
                    onChange={(e) =>
                      setManualForm((prev) => (prev ? { ...prev, due_date: e.target.value } : prev))
                    }
                    className="mt-1 w-full border border-border bg-input px-2 py-1"
                  />
                </label>
                <SmallField
                  label={t("car.editor.notes")}
                  value={manualForm.notes}
                  onChange={(value) =>
                    setManualForm((prev) => (prev ? { ...prev, notes: value } : prev))
                  }
                />
              </div>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => void saveManualReminder()}
                  className="text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
                >
                  [{t("common.save").toUpperCase()}]
                </button>
                <button
                  onClick={() => setManualForm(null)}
                  className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:underline"
                >
                  [{t("common.cancel").toUpperCase()}]
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setManualForm({ title: "", due_date: "", notes: "" })}
              className="mt-2 text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
            >
              [{t("car.addReminder")}]
            </button>
          )}
        </div>
      ) : null}
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

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-4 mb-3 border-b border-border pb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
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
