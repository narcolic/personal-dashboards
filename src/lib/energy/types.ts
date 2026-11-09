export type EnergyInput = {
  provider: string;
  supplyNumber: string;
  invoiceNumber: string | null;
  billType: "actual" | "estimated";
  periodStart: string;
  periodEnd: string;
  billingDays: number;
  issueDate: string;
  dueDate: string | null;
  kwh: number;
  supplyCharges: number;
  regulatedCharges: number;
  taxes: number;
  thirdPartyCharges: number;
  adjustment: number;
  currentTotal: number;
  previousBalance: number;
  amountDue: number;
  fixedCharge: number | null;
  discount: number | null;
  documentHash: string | null;
  fileName: string | null;
  parserVersion: string | null;
};
export type EnergyBill = { id: string; summary: EnergyInput };
export type Draft = { values: Partial<EnergyInput>; warnings: string[] };
export type PdfTextItem = { text: string; x: number; y: number; width: number; height: number };
export type PdfTextPage = { items: PdfTextItem[]; width: number; height: number };

export const amountFields = [
  "supplyCharges",
  "regulatedCharges",
  "taxes",
  "thirdPartyCharges",
  "adjustment",
] as const;
export const cents = (amount: number) => Math.round(amount * 100);
export const chargeTotal = (bill: Pick<EnergyInput, (typeof amountFields)[number]>) =>
  amountFields.reduce((sum, key) => sum + cents(bill[key]), 0) / 100;

export function emptyInput(): Partial<EnergyInput> {
  return {
    provider: "",
    supplyNumber: "",
    billType: "actual",
    invoiceNumber: null,
    dueDate: null,
    adjustment: 0,
    previousBalance: 0,
    fixedCharge: null,
    discount: null,
    documentHash: null,
    fileName: null,
    parserVersion: null,
  };
}

export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + "T00:00:00Z");
  return (
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value &&
    value >= "1900-01-01" &&
    value <= "2200-12-31"
  );
}

export function validateBill(bill: Partial<EnergyInput>): string[] {
  const errors: string[] = [];
  if (
    !bill.provider?.trim() ||
    bill.provider.trim().length > 100 ||
    !bill.supplyNumber?.trim() ||
    bill.supplyNumber.trim().length > 100
  )
    errors.push("identity");
  if (bill.billType !== "actual" && bill.billType !== "estimated") errors.push("identity");
  if ((bill.invoiceNumber?.length ?? 0) > 100) errors.push("identity");
  if (
    !validDate(bill.periodStart) ||
    !validDate(bill.periodEnd) ||
    bill.periodEnd < bill.periodStart ||
    (Date.parse(bill.periodEnd) - Date.parse(bill.periodStart)) / 86400000 > 732 ||
    !validDate(bill.issueDate) ||
    bill.issueDate < bill.periodEnd ||
    (bill.dueDate != null && (!validDate(bill.dueDate) || bill.dueDate < bill.issueDate))
  )
    errors.push("dates");
  if (!Number.isInteger(bill.billingDays) || bill.billingDays! < 1 || bill.billingDays! > 733)
    errors.push("days");
  if (
    typeof bill.kwh !== "number" ||
    !Number.isFinite(bill.kwh) ||
    bill.kwh < 0 ||
    bill.kwh > 10000000 ||
    Math.abs(bill.kwh * 1000 - Math.round(bill.kwh * 1000)) > 0.000001
  )
    errors.push("consumption");
  const keys = [...amountFields, "currentTotal", "previousBalance", "amountDue"] as const;
  if (
    keys.some(
      (key) =>
        typeof bill[key] !== "number" ||
        !Number.isFinite(bill[key]) ||
        Math.abs(bill[key]!) > 1000000 ||
        Math.abs(bill[key]! * 100 - cents(bill[key]!)) > 0.000001,
    )
  )
    errors.push("amounts");
  else {
    if (cents(chargeTotal(bill as EnergyInput)) !== cents(bill.currentTotal!)) errors.push("sum");
    if (cents(bill.currentTotal!) + cents(bill.previousBalance!) !== cents(bill.amountDue!))
      errors.push("balance");
  }
  if (
    [bill.fixedCharge, bill.discount].some(
      (value) =>
        value != null &&
        (!Number.isFinite(value) ||
          Math.abs(value) > 1000000 ||
          Math.abs(value * 100 - cents(value)) > 0.000001),
    ) ||
    (bill.fixedCharge ?? 0) < 0 ||
    (bill.discount ?? 0) > 0
  )
    errors.push("details");
  return [...new Set(errors)];
}
