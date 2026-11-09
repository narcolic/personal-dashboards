import { lazy, Suspense, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  amountFields,
  chargeTotal,
  emptyInput,
  validateBill,
  type Draft,
  type EnergyInput,
} from "@/lib/energy/types";

const PdfPreview = lazy(() =>
  import("./PdfPreview").then((module) => ({ default: module.PdfPreview })),
);
type Props = {
  draft: Draft;
  file: File | null;
  existing: boolean;
  busy: boolean;
  error: string | null;
  onSave: (bill: EnergyInput) => void;
  onCancel: () => void;
};

export function BillReview({ draft, file, existing, busy, error, onSave, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const [values, setValues] = useState<Partial<EnergyInput>>(() => ({
    ...emptyInput(),
    ...draft.values,
  }));
  const [editing, setEditing] = useState(() => validateBill(values).length > 0);
  const [submitted, setSubmitted] = useState(false);
  const errors = validateBill(values);
  const money = (value: number | null | undefined) =>
    value == null
      ? "—"
      : new Intl.NumberFormat(i18n.language, { style: "currency", currency: "EUR" }).format(value);
  const update = (key: keyof EnergyInput, value: string | number | null | undefined) =>
    setValues((old) => ({ ...old, [key]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!errors.length) onSave(values as EnergyInput);
    else setEditing(true);
  };
  const numeric = (key: keyof EnergyInput, optional = false) => (
    <input
      className="energy-input energy-numeric"
      type="number"
      step={key === "kwh" ? "0.001" : "0.01"}
      min={key === "kwh" || key === "fixedCharge" ? 0 : -1000000}
      max={key === "kwh" ? 10000000 : 1000000}
      aria-label={t(`energy.fields.${key}`)}
      required={!optional}
      value={values[key] == null ? "" : String(values[key])}
      onChange={(event) =>
        update(
          key,
          event.target.value === "" ? (optional ? null : undefined) : event.target.valueAsNumber,
        )
      }
    />
  );
  const field = (key: keyof EnergyInput, optional = false) => (
    <div className="energy-field" key={key}>
      <dt>{t(`energy.fields.${key}`)}</dt>
      <dd>
        {editing
          ? numeric(key, optional)
          : key === "kwh"
            ? `${values.kwh ?? "—"} kWh`
            : money(values[key] as number | null | undefined)}
      </dd>
    </div>
  );
  const date = (key: "issueDate" | "dueDate" | "periodStart" | "periodEnd") => (
    <label className="energy-label">
      {t(`energy.fields.${key}`)}
      <input
        className="energy-input"
        type="date"
        value={values[key] ?? ""}
        required={key !== "dueDate"}
        onChange={(event) => update(key, event.target.value || null)}
      />
    </label>
  );

  return (
    <div className="energy-workspace">
      <header className="energy-row">
        <div>
          <p className="energy-eyebrow">{t("energy.reviewStep")}</p>
          <h1>{t(existing ? "energy.billDetails" : "energy.reviewTitle")}</h1>
          <p className="energy-muted">{file?.name ?? t("energy.summaryOnly")}</p>
        </div>
        <button className="energy-button" disabled={busy} type="button" onClick={onCancel}>
          {t("energy.back")}
        </button>
      </header>
      <div className={file ? "energy-review-grid" : "energy-review-single"}>
        {file && (
          <Suspense fallback={<p role="status">{t("energy.reading")}</p>}>
            <PdfPreview file={file} />
          </Suspense>
        )}
        <form className="energy-panel" onSubmit={submit}>
          <div className="energy-panel-head energy-row">
            <h2>{t("energy.willStore")}</h2>
            <button
              className="energy-button"
              disabled={busy}
              type="button"
              onClick={() => setEditing((value) => !value)}
            >
              {t(editing ? "energy.doneEditing" : "energy.edit")}
            </button>
          </div>
          <div className="energy-panel-body">
            <div className="energy-row">
              <h2>{values.provider || t("energy.unknownProvider")}</h2>
              <span className="energy-badge">{t(`energy.${values.billType ?? "actual"}`)}</span>
            </div>
            <p className="energy-muted text-sm mt-2">
              {values.periodStart ?? "—"} → {values.periodEnd ?? "—"} · {values.billingDays ?? "—"}{" "}
              {t("energy.days")}
            </p>
            {draft.warnings.length > 0 && (
              <div className="energy-notice mt-4" role="status">
                {draft.warnings.map((warning) => (
                  <p key={warning}>{t(`energy.warnings.${warning}`)}</p>
                ))}
              </div>
            )}
            <fieldset disabled={busy}>
              {editing && (
                <details className="mt-4" open>
                  <summary>{t("energy.billIdentity")}</summary>
                  <div className="energy-form-grid mt-3">
                    {(["provider", "supplyNumber", "invoiceNumber"] as const).map((key) => (
                      <label key={key} className="energy-label">
                        {t(`energy.fields.${key}`)}
                        <input
                          className="energy-input"
                          maxLength={100}
                          required={key !== "invoiceNumber"}
                          value={values[key] ?? ""}
                          onChange={(event) => update(key, event.target.value || null)}
                        />
                      </label>
                    ))}
                    <label className="energy-label">
                      {t("energy.fields.billType")}
                      <select
                        className="energy-input"
                        value={values.billType ?? ""}
                        required
                        onChange={(event) => update("billType", event.target.value)}
                      >
                        <option value="" disabled>
                          {t("energy.fields.billType")}
                        </option>
                        <option value="actual">{t("energy.actual")}</option>
                        <option value="estimated">{t("energy.estimated")}</option>
                      </select>
                    </label>
                    {date("periodStart")}
                    {date("periodEnd")}
                    {date("issueDate")}
                    {date("dueDate")}
                    <label className="energy-label">
                      {t("energy.fields.billingDays")}
                      <input
                        className="energy-input"
                        type="number"
                        min={1}
                        max={733}
                        step={1}
                        required
                        value={values.billingDays ?? ""}
                        onChange={(event) =>
                          update(
                            "billingDays",
                            event.target.value === "" ? undefined : event.target.valueAsNumber,
                          )
                        }
                      />
                    </label>
                  </div>
                </details>
              )}
              <dl className="mt-4">
                {field("kwh")}
                {amountFields
                  .filter((key) => key !== "adjustment" || editing || values.adjustment)
                  .map((key) => field(key))}
                <div className="energy-field energy-total">
                  <dt>{t("energy.fields.currentTotal")}</dt>
                  <dd>{editing ? numeric("currentTotal") : money(values.currentTotal)}</dd>
                </div>
                {(editing ||
                  values.previousBalance !== 0 ||
                  values.amountDue !== values.currentTotal) && (
                  <>
                    {field("previousBalance")}
                    {field("amountDue")}
                  </>
                )}
              </dl>
              {editing && (
                <button
                  className="energy-button mt-3"
                  type="button"
                  onClick={() => {
                    if (
                      amountFields.every(
                        (key) => typeof values[key] === "number" && Number.isFinite(values[key]),
                      )
                    ) {
                      const total = chargeTotal(values as EnergyInput);
                      setValues((old) => ({
                        ...old,
                        currentTotal: total,
                        amountDue: Math.round((total + (old.previousBalance ?? 0)) * 100) / 100,
                      }));
                    }
                  }}
                >
                  {t("energy.useSum")}
                </button>
              )}
              {(editing || values.fixedCharge != null || values.discount != null) && (
                <details className="mt-4">
                  <summary>{t("energy.includedDetails")}</summary>
                  <dl>
                    {field("fixedCharge", true)}
                    {field("discount", true)}
                  </dl>
                  <p className="energy-muted text-xs mt-2">{t("energy.alreadyIncluded")}</p>
                </details>
              )}
            </fieldset>
            <p className="energy-muted text-xs mt-5">
              {t("energy.fields.issueDate")}: {values.issueDate ?? "—"} ·{" "}
              {t("energy.fields.dueDate")}: {values.dueDate ?? "—"}
            </p>
            <p className="energy-muted text-xs mt-2">{t("energy.localOnly")}</p>
            {(submitted || editing) && errors.length > 0 && (
              <div className="energy-errors mt-4" role="alert">
                {errors.map((key) => (
                  <p key={key}>{t(`energy.validation.${key}`)}</p>
                ))}
              </div>
            )}
            {error && (
              <p className="energy-errors mt-4" role="alert">
                {error}
              </p>
            )}
            <div className="energy-row mt-5">
              <button className="energy-button" type="button" disabled={busy} onClick={onCancel}>
                {t("energy.cancel")}
              </button>
              <button className="energy-button energy-primary" type="submit" disabled={busy}>
                {t(busy ? "energy.saving" : existing ? "energy.saveChanges" : "energy.accept")}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
