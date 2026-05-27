import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  ServiceJob,
  ServiceJobInput,
  ServiceVisitWithJobs,
  Vehicle,
} from "@/routes/_authenticated/car-service/types";
import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";

const CATEGORY_SUGGESTIONS = [
  "AC",
  "ΕΛΑΣΤΙΚΑ",
  "ΕΛΕΓΧΟΣ",
  "ΗΛΕΚΤΡΙΚΑ",
  "ΛΑΔΙ",
  "ΛΟΙΠΑ",
  "ΦΑΝΟΠΟΙΙΑ",
  "ΦΙΛΤΡΑ",
  "ΦΡΕΝΑ",
];

type JobLine = {
  jobName: string;
  category: string;
  unitPriceExVat: string;
  quantity: string;
  notes: string;
};

type FormValues = {
  vehicleId: string;
  serviceDate: string;
  odometerKm: string;
  workshop: string;
  vatRatePct: string;
  notes: string;
};

type FieldErrors = {
  vehicleId?: string;
  serviceDate?: string;
  odometerKm?: string;
  jobs?: string;
  jobRows?: Record<number, string>;
};

function mapJobToLine(job: ServiceJob): JobLine {
  return {
    jobName: job.job_name_snapshot,
    category: job.category_snapshot ?? "",
    unitPriceExVat: String(job.unit_price_ex_vat),
    quantity: String(job.quantity),
    notes: job.notes ?? "",
  };
}

export function ServiceHistoryEditor({
  initialVisit,
  vehicles,
  defaultVehicleId,
  jobSuggestions,
  submitLabel,
  saveError,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
}: {
  initialVisit?: ServiceVisitWithJobs;
  vehicles: Vehicle[];
  defaultVehicleId?: string;
  jobSuggestions: string[];
  submitLabel: string;
  saveError: string | null;
  isSaving: boolean;
  isDeleting?: boolean;
  onSave: (payload: {
    visit: {
      vehicle_id: string;
      service_date: string;
      odometer_km: number;
      workshop: string | null;
      notes: string | null;
      vat_rate: number;
    };
    jobs: ServiceJobInput[];
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const initialVehicleId =
    initialVisit?.vehicle_id ?? defaultVehicleId ?? (vehicles.length === 1 ? vehicles[0].id : "");

  const [form, setForm] = useState<FormValues>({
    vehicleId: initialVehicleId,
    serviceDate: initialVisit?.service_date ?? "",
    odometerKm: initialVisit ? String(initialVisit.odometer_km) : "",
    workshop: initialVisit?.workshop ?? "",
    vatRatePct: initialVisit ? String(Number(initialVisit.vat_rate) * 100) : "24",
    notes: initialVisit?.notes ?? "",
  });
  const [lines, setLines] = useState<JobLine[]>(
    initialVisit?.jobs.length
      ? initialVisit.jobs.map(mapJobToLine)
      : [{ jobName: "", category: "", unitPriceExVat: "", quantity: "1", notes: "" }],
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [jobMenuOpenIndex, setJobMenuOpenIndex] = useState<number | null>(null);
  const [categoryMenuOpenIndex, setCategoryMenuOpenIndex] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (initialVisit) return;
    if (form.vehicleId) return;
    if (vehicles.length === 1 && vehicles[0]?.id) {
      setForm((prev) => ({ ...prev, vehicleId: vehicles[0].id }));
    }
  }, [initialVisit, form.vehicleId, vehicles]);

  const computedLines = useMemo(
    () =>
      lines.map((line) => {
        const quantity = Number(line.quantity || 0);
        const price = Number(line.unitPriceExVat || 0);
        const total = Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : 0;
        return { quantity, price, total };
      }),
    [lines],
  );

  const subtotal = computedLines.reduce((sum, line) => sum + line.total, 0);
  const vatRate = Number(form.vatRatePct || 0) / 100;
  const vatAmount = subtotal * vatRate;
  const totalAmount = subtotal + vatAmount;

  const setFormField = (key: keyof FormValues, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setLineField = (index: number, key: keyof JobLine, value: string) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { jobName: "", category: "", unitPriceExVat: "", quantity: "1", notes: "" },
    ]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const validate = (): ServiceJobInput[] | null => {
    const nextErrors: FieldErrors = {};
    const rowErrors: Record<number, string> = {};

    if (!form.vehicleId) nextErrors.vehicleId = t("car.editor.vehicleRequired");
    if (!form.serviceDate) nextErrors.serviceDate = t("car.editor.serviceDateRequired");

    const km = Number(form.odometerKm);
    if (!Number.isFinite(km) || km < 0) nextErrors.odometerKm = t("car.editor.kmRequired");

    const validLines: ServiceJobInput[] = [];

    lines.forEach((line, index) => {
      const jobName = line.jobName.trim();
      const quantity = Number(line.quantity);
      const price = Number(line.unitPriceExVat);

      if (!jobName) {
        rowErrors[index] = t("car.editor.jobNameRequired");
        return;
      }

      if (!Number.isFinite(price) || price < 0) {
        rowErrors[index] = t("car.editor.priceRequired");
        return;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        rowErrors[index] = t("car.editor.quantityRequired");
        return;
      }

      validLines.push({
        jobName,
        category: line.category.trim() || "?????",
        unitPriceExVat: Number(price.toFixed(2)),
        quantity: Number(quantity.toFixed(2)),
        notes: line.notes.trim() || undefined,
      });
    });

    if (validLines.length === 0) nextErrors.jobs = t("car.editor.oneJobRequired");
    if (Object.keys(rowErrors).length > 0) nextErrors.jobRows = rowErrors;

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;
    return validLines;
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const validJobs = validate();
    if (!validJobs) return;

    await onSave({
      visit: {
        vehicle_id: form.vehicleId,
        service_date: form.serviceDate,
        odometer_km: Number(form.odometerKm),
        workshop: form.workshop.trim() || null,
        notes: form.notes.trim() || null,
        vat_rate: Number((Number(form.vatRatePct) / 100).toFixed(4)),
      },
      jobs: validJobs,
    });
  };

  return (
    <form onSubmit={save} className="border border-border bg-card font-mono">
      <section className="p-4 md:p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t("car.editor.vehicle")} error={errors.vehicleId}>
            <select
              value={form.vehicleId}
              onChange={(e) => setFormField("vehicleId", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              <option value="">{t("car.editor.selectVehicle")}</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {`${vehicle.make ?? ""} ${vehicle.model ?? ""} ${vehicle.year ?? ""}`.trim()}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("car.editor.date")} error={errors.serviceDate}>
            <input
              type="date"
              value={form.serviceDate}
              onChange={(e) => setFormField("serviceDate", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("car.editor.km")} error={errors.odometerKm}>
            <input
              type="number"
              min="0"
              value={form.odometerKm}
              onChange={(e) => setFormField("odometerKm", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("car.editor.garage")}>
            <input
              type="text"
              value={form.workshop}
              onChange={(e) => setFormField("workshop", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("car.editor.vatRate")}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.vatRatePct}
              onChange={(e) => setFormField("vatRatePct", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("car.editor.notes")} className="md:col-span-2">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setFormField("notes", e.target.value)}
              className="w-full border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </Field>
        </div>
      </section>

      <div className="border-b border-border" />

      <section className="p-4 md:p-6 space-y-3">
        <div className="grid grid-cols-14 gap-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <div className="col-span-3">{t("car.editor.jobTask")}</div>
          <div className="col-span-2">{t("car.editor.category")}</div>
          <div className="col-span-2 text-right">{t("car.editor.priceExVat")}</div>
          <div className="col-span-1 text-right">{t("car.editor.qty")}</div>
          <div className="col-span-2 text-right">{t("car.editor.lineTotal")}</div>
          <div className="col-span-2">{t("car.editor.notes")}</div>
          <div className="col-span-2 text-right">{t("car.editor.remove")}</div>
        </div>

        {lines.map((line, index) => {
          const query = line.jobName.trim().toLowerCase();
          const options = jobSuggestions
            .filter((item) => item.toLowerCase().includes(query))
            .sort((a, b) => a.localeCompare(b));
          const exactMatch = options.some((option) => option.toLowerCase() === query);

          const categoryQuery = line.category.trim().toUpperCase();
          const categoryOptions = CATEGORY_SUGGESTIONS.filter((item) =>
            item.includes(categoryQuery),
          );
          const categoryExactMatch = categoryOptions.some((option) => option === categoryQuery);

          return (
            <div key={`line-${index}`} className="space-y-1">
              <div className="grid grid-cols-14 gap-2 text-[11px]">
                <div className="col-span-3 relative">
                  <input
                    value={line.jobName}
                    onFocus={() => setJobMenuOpenIndex(index)}
                    onBlur={() =>
                      setTimeout(() => setJobMenuOpenIndex((v) => (v === index ? null : v)), 120)
                    }
                    onChange={(e) => setLineField(index, "jobName", e.target.value)}
                    className="w-full border border-border bg-input px-2 py-1.5 text-foreground focus:border-primary focus:outline-none"
                  />
                  {jobMenuOpenIndex === index && (query.length > 0 || options.length > 0) ? (
                    <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto border border-border bg-card">
                      {options.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onMouseDown={() => {
                            setLineField(index, "jobName", option);
                            setJobMenuOpenIndex(null);
                          }}
                          className="block w-full px-2 py-1.5 text-left hover:bg-primary/10 hover:text-primary"
                        >
                          {option}
                        </button>
                      ))}
                      {query.length > 0 && !exactMatch ? (
                        <button
                          type="button"
                          onMouseDown={() => {
                            setLineField(index, "jobName", line.jobName.trim());
                            setJobMenuOpenIndex(null);
                          }}
                          className="block w-full px-2 py-1.5 text-left hover:bg-primary/10 hover:text-primary"
                        >
                          {t("car.editor.createValue", { value: line.jobName.trim() })}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="col-span-2 relative">
                  <input
                    value={line.category}
                    onFocus={() => setCategoryMenuOpenIndex(index)}
                    onBlur={() =>
                      setTimeout(
                        () => setCategoryMenuOpenIndex((v) => (v === index ? null : v)),
                        120,
                      )
                    }
                    onChange={(e) => setLineField(index, "category", e.target.value.toUpperCase())}
                    className="w-full border border-border bg-input px-2 py-1.5 text-foreground focus:border-primary focus:outline-none"
                  />
                  {categoryMenuOpenIndex === index &&
                  (categoryQuery.length > 0 || categoryOptions.length > 0) ? (
                    <div className="absolute z-10 mt-1 max-h-44 w-full overflow-auto border border-border bg-card">
                      {categoryOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onMouseDown={() => {
                            setLineField(index, "category", option);
                            setCategoryMenuOpenIndex(null);
                          }}
                          className="block w-full px-2 py-1.5 text-left hover:bg-primary/10 hover:text-primary"
                        >
                          {option}
                        </button>
                      ))}
                      {categoryQuery.length > 0 && !categoryExactMatch ? (
                        <button
                          type="button"
                          onMouseDown={() => {
                            setLineField(index, "category", line.category.trim().toUpperCase());
                            setCategoryMenuOpenIndex(null);
                          }}
                          className="block w-full px-2 py-1.5 text-left hover:bg-primary/10 hover:text-primary"
                        >
                          {t("car.editor.createValue", { value: line.category.trim().toUpperCase() })}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.unitPriceExVat}
                    onChange={(e) => setLineField(index, "unitPriceExVat", e.target.value)}
                    className="w-full border border-border bg-input px-2 py-1.5 text-right text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="col-span-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={line.quantity}
                    onChange={(e) => setLineField(index, "quantity", e.target.value)}
                    className="w-full border border-border bg-input px-2 py-1.5 text-right text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="col-span-2 px-2 py-1.5 text-right text-muted-foreground">
                  {formatCurrency(computedLines[index]?.total ?? 0)}
                </div>
                <div className="col-span-2">
                  <input
                    value={line.notes}
                    onChange={(e) => setLineField(index, "notes", e.target.value)}
                    className="w-full border border-border bg-input px-2 py-1.5 text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="col-span-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="px-2 py-1.5 text-destructive hover:underline"
                  >
                    x
                  </button>
                </div>
              </div>
              {errors.jobRows?.[index] ? (
                <div className="text-[11px] text-destructive">{errors.jobRows[index]}</div>
              ) : null}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addLine}
          className="text-[11px] uppercase tracking-[0.2em] text-primary hover:underline"
        >
          {t("car.editor.addJob")}
        </button>
        {errors.jobs ? <div className="text-[11px] text-destructive">{errors.jobs}</div> : null}
      </section>

      <div className="border-t border-border p-4 md:p-6">
        <div className="ml-auto w-full max-w-xs space-y-2 text-[11px] uppercase tracking-[0.2em]">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("car.editor.subtotalExVat")}</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("car.editor.vatAmount")}</span>
            <span>{formatCurrency(vatAmount)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-muted-foreground">{t("car.editor.totalInclVat")}</span>
            <span className="text-primary">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        {saveError ? <div className="mt-3 text-[11px] text-destructive">{saveError}</div> : null}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={isSaving}
            className="bg-primary px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {isSaving ? t("car.editor.saving") : submitLabel}
          </button>

          {onDelete ? (
            confirmDelete ? (
              <>
                <button
                  type="button"
                  disabled={Boolean(isDeleting)}
                  onClick={() => void onDelete()}
                  className="px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-destructive hover:underline disabled:opacity-60"
                >
                  {isDeleting ? t("car.editor.deleting") : t("car.editor.confirmDelete")}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                >
                  {t("common.cancel")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-destructive hover:underline"
              >
                {t("car.editor.deleteVisit")}
              </button>
            )
          ) : null}
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  error,
  className = "",
}: {
  label: string;
  children: ReactNode;
  error?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      {children}
      {error ? <div className="mt-1 text-[11px] text-destructive">{error}</div> : null}
    </label>
  );
}
