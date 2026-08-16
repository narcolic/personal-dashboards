import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type {
  ServiceJob,
  ServiceJobInput,
  ServiceVisitWithJobs,
  Vehicle,
} from "@/routes/_authenticated/car-service/types";
import { formatCurrency } from "@/routes/_authenticated/car-service/utils/carServiceUtils";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TerminalSelect } from "@/components/ui/TerminalSelect";

const BASE_CATEGORY_SUGGESTIONS = [
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
  isAnnualService: boolean;
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
  categorySuggestions = [],
  submitLabel,
  saveError,
  isSaving,
  isDeleting,
  onSave,
  onDelete,
  onCancel,
}: {
  initialVisit?: ServiceVisitWithJobs;
  vehicles: Vehicle[];
  defaultVehicleId?: string;
  jobSuggestions: string[];
  categorySuggestions?: string[];
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
      is_annual_service: boolean;
    };
    jobs: ServiceJobInput[];
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel?: () => void;
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
    isAnnualService: initialVisit?.is_annual_service ?? false,
  });
  const [lines, setLines] = useState<JobLine[]>(
    initialVisit?.jobs.length
      ? initialVisit.jobs.map(mapJobToLine)
      : [{ jobName: "", category: "", unitPriceExVat: "", quantity: "1", notes: "" }],
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [jobMenuOpenIndex, setJobMenuOpenIndex] = useState<number | null>(null);
  const [categoryMenuOpenIndex, setCategoryMenuOpenIndex] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const mergedCategorySuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          [...BASE_CATEGORY_SUGGESTIONS, ...categorySuggestions]
            .map((item) => item.trim().toUpperCase())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [categorySuggestions],
  );
  const resolvedVehicleId =
    form.vehicleId ||
    (!initialVisit && vehicles.length === 1 && vehicles[0]?.id ? vehicles[0].id : "");

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

    if (!resolvedVehicleId) nextErrors.vehicleId = t("car.editor.vehicleRequired");
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
        vehicle_id: resolvedVehicleId,
        service_date: form.serviceDate,
        odometer_km: Number(form.odometerKm),
        workshop: form.workshop.trim() || null,
        notes: form.notes.trim() || null,
        vat_rate: Number((Number(form.vatRatePct) / 100).toFixed(4)),
        is_annual_service: form.isAnnualService,
      },
      jobs: validJobs,
    });
  };

  return (
    <form
      onSubmit={save}
      className="analytics-panel overflow-hidden rounded-[10px] border border-border/70 bg-card/70 font-mono shadow-[0_16px_45px_-38px_rgba(0,0,0,0.9)]"
    >
      <section className="p-4 md:p-5">
        <SectionHeader
          eyebrow={t("car.editor.visitDetails")}
          summary={initialVisit ? form.serviceDate : undefined}
        />

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label={t("car.editor.vehicle")} error={errors.vehicleId}>
            <TerminalSelect
              value={resolvedVehicleId}
              onChange={(value) => setFormField("vehicleId", value)}
              ariaLabel={t("car.editor.vehicle")}
              options={[
                { value: "", label: t("car.editor.selectVehicle") },
                ...vehicles.map((vehicle) => ({
                  value: vehicle.id,
                  label:
                    `${vehicle.make ?? ""} ${vehicle.model ?? ""} ${vehicle.year ?? ""}`.trim(),
                })),
              ]}
            />
          </Field>

          <Field label={t("car.editor.date")} error={errors.serviceDate}>
            <input
              type="date"
              value={form.serviceDate}
              onChange={(e) => setFormField("serviceDate", e.target.value)}
              className="h-10 w-full rounded-md border border-border/70 bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("car.editor.km")} error={errors.odometerKm}>
            <input
              type="number"
              min="0"
              value={form.odometerKm}
              onChange={(e) => setFormField("odometerKm", e.target.value)}
              className="h-10 w-full rounded-md border border-border/70 bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </Field>

          <Field label={t("car.editor.garage")}>
            <input
              type="text"
              value={form.workshop}
              onChange={(e) => setFormField("workshop", e.target.value)}
              className="h-10 w-full rounded-md border border-border/70 bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,180px)_1fr] md:col-span-2">
            <Field label={t("car.editor.vatRate")}>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.vatRatePct}
                onChange={(e) => setFormField("vatRatePct", e.target.value)}
                className="h-10 w-full rounded-md border border-border/70 bg-input px-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </Field>

            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-border/70 bg-background/25 px-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground sm:mt-[18px]">
              <input
                type="checkbox"
                checked={form.isAnnualService}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, isAnnualService: e.target.checked }))
                }
                className="h-4 w-4 accent-primary"
              />
              <span>{t("car.editor.markAsAnnualService")}</span>
            </label>
          </div>

          <Field label={t("car.editor.notes")} className="md:col-span-2">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setFormField("notes", e.target.value)}
              className="w-full rounded-md border border-border/70 bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </Field>
        </div>
      </section>

      <div className="border-b border-border" />

      <section className="space-y-3 p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeader
            eyebrow={t("car.editor.serviceJobs")}
            summary={t("car.editor.jobCount", { count: lines.length })}
          />
          <button
            type="button"
            onClick={addLine}
            className="inline-flex h-9 items-center rounded-md border border-primary/35 px-3 text-[10px] uppercase tracking-[0.14em] text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {t("car.editor.addJob")}
          </button>
        </div>

        <div className="overflow-visible rounded-lg border border-border/70 bg-background/20">
          <div className="hidden grid-cols-14 gap-2 border-b border-border/70 bg-secondary/15 px-3 py-2.5 text-[9px] uppercase tracking-[0.16em] text-muted-foreground md:grid">
            <div className="col-span-3">{t("car.editor.jobTask")}</div>
            <div className="col-span-2">{t("car.editor.category")}</div>
            <div className="col-span-2 text-right">{t("car.editor.priceExVat")}</div>
            <div className="col-span-1 text-right">{t("car.editor.qty")}</div>
            <div className="col-span-2 text-right">{t("car.editor.lineTotal")}</div>
            <div className="col-span-2">{t("car.editor.notes")}</div>
            <div className="col-span-2 text-right">{t("car.editor.actions")}</div>
          </div>

          {lines.map((line, index) => {
            const query = line.jobName.trim().toLowerCase();
            const options = jobSuggestions
              .filter((item) => item.toLowerCase().includes(query))
              .sort((a, b) => a.localeCompare(b));
            const exactMatch = options.some((option) => option.toLowerCase() === query);

            const categoryQuery = line.category.trim().toUpperCase();
            const categoryOptions = mergedCategorySuggestions.filter((item) =>
              item.includes(categoryQuery),
            );
            const categoryExactMatch = categoryOptions.some((option) => option === categoryQuery);

            return (
              <div
                key={`line-${index}`}
                className="space-y-1 border-b border-border/55 bg-background/10 p-3 last:border-b-0 md:px-3 md:py-2"
              >
                <div className="mb-2 flex items-center justify-between md:hidden">
                  <span className="text-[9px] uppercase tracking-[0.18em] text-primary">
                    {t("car.editor.jobNumber", { number: String(index + 1).padStart(2, "0") })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    disabled={lines.length === 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/25 text-base text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={t("car.editor.removeJobAria", { index: index + 1 })}
                  >
                    ×
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px] md:grid-cols-14 md:gap-2">
                  <div className="relative col-span-2 md:col-span-3">
                    <MobileFieldLabel>{t("car.editor.jobTask")}</MobileFieldLabel>
                    <input
                      value={line.jobName}
                      onFocus={() => setJobMenuOpenIndex(index)}
                      onBlur={() =>
                        setTimeout(() => setJobMenuOpenIndex((v) => (v === index ? null : v)), 120)
                      }
                      onChange={(e) => setLineField(index, "jobName", e.target.value)}
                      className="h-10 w-full rounded-md border border-border/70 bg-input px-3 text-foreground focus:border-primary focus:outline-none md:h-9 md:px-2"
                    />
                    {jobMenuOpenIndex === index && (query.length > 0 || options.length > 0) ? (
                      <div className="terminal-scrollbar absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-border/70 bg-popover/95 p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl">
                        {options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onMouseDown={() => {
                              setLineField(index, "jobName", option);
                              setJobMenuOpenIndex(null);
                            }}
                            className="block w-full rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] transition-colors hover:bg-secondary/55 hover:text-foreground"
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
                            className="block w-full rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/10"
                          >
                            {t("car.editor.createValue", { value: line.jobName.trim() })}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="relative col-span-2 md:col-span-2">
                    <MobileFieldLabel>{t("car.editor.category")}</MobileFieldLabel>
                    <input
                      value={line.category}
                      onFocus={() => setCategoryMenuOpenIndex(index)}
                      onBlur={() =>
                        setTimeout(
                          () => setCategoryMenuOpenIndex((v) => (v === index ? null : v)),
                          120,
                        )
                      }
                      onChange={(e) =>
                        setLineField(index, "category", e.target.value.toUpperCase())
                      }
                      className="h-10 w-full rounded-md border border-border/70 bg-input px-3 text-foreground focus:border-primary focus:outline-none md:h-9 md:px-2"
                    />
                    {categoryMenuOpenIndex === index &&
                    (categoryQuery.length > 0 || categoryOptions.length > 0) ? (
                      <div className="terminal-scrollbar absolute z-10 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-border/70 bg-popover/95 p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.95)] backdrop-blur-xl">
                        {categoryOptions.map((option) => (
                          <button
                            key={option}
                            type="button"
                            onMouseDown={() => {
                              setLineField(index, "category", option);
                              setCategoryMenuOpenIndex(null);
                            }}
                            className="block w-full rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] transition-colors hover:bg-secondary/55 hover:text-foreground"
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
                            className="block w-full rounded-md px-3 py-2 text-left text-[11px] uppercase tracking-[0.08em] text-primary transition-colors hover:bg-primary/10"
                          >
                            {t("car.editor.createValue", {
                              value: line.category.trim().toUpperCase(),
                            })}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <MobileFieldLabel>{t("car.editor.priceExVat")}</MobileFieldLabel>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.unitPriceExVat}
                      onChange={(e) => setLineField(index, "unitPriceExVat", e.target.value)}
                      className="h-10 w-full rounded-md border border-border/70 bg-input px-3 text-right text-foreground focus:border-primary focus:outline-none md:h-9 md:px-2"
                    />
                  </div>
                  <div className="col-span-1 md:col-span-1">
                    <MobileFieldLabel>{t("car.editor.qty")}</MobileFieldLabel>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.quantity}
                      onChange={(e) => setLineField(index, "quantity", e.target.value)}
                      className="h-10 w-full rounded-md border border-border/70 bg-input px-3 text-right text-foreground focus:border-primary focus:outline-none md:h-9 md:px-2"
                    />
                  </div>
                  <div className="col-span-1 rounded-md bg-secondary/25 px-3 py-2 text-left text-muted-foreground md:col-span-2 md:flex md:h-9 md:items-center md:justify-end md:bg-transparent md:px-2 md:py-0 md:text-right">
                    <MobileFieldLabel>{t("car.editor.lineTotal")}</MobileFieldLabel>
                    <span className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(computedLines[index]?.total ?? 0)}
                    </span>
                  </div>
                  <div className="col-span-2 md:col-span-2">
                    <MobileFieldLabel>{t("car.editor.notes")}</MobileFieldLabel>
                    <input
                      value={line.notes}
                      onChange={(e) => setLineField(index, "notes", e.target.value)}
                      className="h-10 w-full rounded-md border border-border/70 bg-input px-3 text-foreground focus:border-primary focus:outline-none md:h-9 md:px-2"
                    />
                  </div>
                  <div className="hidden items-center justify-end md:col-span-2 md:flex">
                    <button
                      type="button"
                      onClick={() => removeLine(index)}
                      disabled={lines.length === 1}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-base text-destructive transition-colors hover:border-destructive/25 hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label={t("car.editor.removeJobAria", { index: index + 1 })}
                    >
                      ×
                    </button>
                  </div>
                </div>
                {errors.jobRows?.[index] ? (
                  <div className="text-[11px] text-destructive">{errors.jobRows[index]}</div>
                ) : null}
              </div>
            );
          })}
        </div>
        {errors.jobs ? <div className="text-[11px] text-destructive">{errors.jobs}</div> : null}
      </section>

      <div className="sticky bottom-10 z-[8] border-t border-border/70 bg-card/95 p-3 backdrop-blur-xl md:static md:p-5">
        {saveError ? (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
            {saveError}
          </div>
        ) : null}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div
            role="group"
            aria-label={t("car.editor.actionsGroupAria")}
            className="order-2 flex flex-wrap items-center gap-2 lg:order-1"
          >
            {onDelete ? (
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="inline-flex h-10 items-center rounded-md border border-destructive/30 px-3 text-[10px] uppercase tracking-[0.14em] text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
              >
                {t("car.editor.deleteVisit")}
              </button>
            ) : null}

            <div className="ml-auto flex items-center gap-2 lg:ml-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60"
              >
                {isSaving ? t("car.editor.saving") : submitLabel}
              </button>

              {onCancel ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex h-10 items-center rounded-md border border-border/70 px-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {t("common.cancel")}
                </button>
              ) : null}
            </div>
          </div>

          <div className="order-1 grid grid-cols-3 overflow-hidden rounded-md border border-border/70 bg-background/30 text-[9px] uppercase tracking-[0.12em] lg:order-2 lg:min-w-[440px]">
            <TotalMetric label={t("car.editor.subtotalExVat")} value={formatCurrency(subtotal)} />
            <TotalMetric label={t("car.editor.vatAmount")} value={formatCurrency(vatAmount)} />
            <TotalMetric
              label={t("car.editor.totalInclVat")}
              value={formatCurrency(totalAmount)}
              emphasized
            />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={t("common.delete")}
        description={t("car.editor.deleteVisitWarning")}
        confirmLabel={isDeleting ? t("car.editor.deleting") : t("common.delete")}
        isConfirming={Boolean(isDeleting)}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => void onDelete?.()}
      />
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

function SectionHeader({ eyebrow, summary }: { eyebrow: string; summary?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="text-primary">›</span>
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">
        {eyebrow}
      </h2>
      <span className="h-px min-w-4 flex-1 bg-border/60" />
      {summary ? (
        <span className="shrink-0 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {summary}
        </span>
      ) : null}
    </div>
  );
}

function TotalMetric({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="min-w-0 border-r border-border/60 px-3 py-2.5 text-right last:border-r-0">
      <div className="truncate text-[8px] text-muted-foreground">{label}</div>
      <div
        className={`mt-1 truncate text-[11px] font-semibold tabular-nums ${emphasized ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function MobileFieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1 block text-[9px] uppercase tracking-[0.1em] text-muted-foreground md:hidden">
      {children}
    </span>
  );
}
