import test from "node:test";
import assert from "node:assert/strict";
import { greekNumber, parseZenith } from "../src/lib/energy/parser.ts";
import { billYears, energyAnalytics } from "../src/lib/energy/analytics.ts";
import {
  validateBill,
  type EnergyInput,
  type PdfTextItem,
  type PdfTextPage,
} from "../src/lib/energy/types.ts";

// Synthetic text fragments reproduce the provider's two-column geometry without personal data.
const item = (text: string, x: number, y: number): PdfTextItem => ({
  text,
  x,
  y,
  width: text.length * 4,
  height: 9,
});
const row = (label: string, value: string, y: number) => [item(label, 38, y), item(value, 250, y)];
const pages: PdfTextPage[] = [
  {
    width: 595,
    height: 842,
    items: [
      item("Εκκαθαριστικός", 40, 730),
      ...row("Χρέωση Προμήθειας", "32,99 €", 594),
      ...row("Ρυθμιζόμενες Χρεώσεις", "22,12 €", 582),
      ...row("Φόροι - τέλη", "4,09 €", 570),
      ...row("Χρεώσεις υπέρ Τρίτων", "19,89 €", 558),
      item("79,09 €", 453, 540),
      item("26/11/2026", 443, 503),
      item("79,09 €", 250, 484),
      ...row("Αριθμός παροχής", "TEST-SUPPLY", 334),
      ...row("Α/Α λογαριασμού", "TEST-2026-11", 240),
      ...row("Ημερομηνία έκδοσης", "06/11/2026", 228),
      item("Περίοδος κατανάλωσης 19/09/2026-18/10/2026", 38, 216),
      ...row("Ημέρες τιμολόγησης", "29", 204),
      ...row("Ύψοςκατανάλωσης", "223 kWh", 192),
    ],
  },
  {
    width: 595,
    height: 842,
    items: [
      item("Πάγιο Τέλος", 30, 715),
      item("9,57 €", 263, 707),
      item("Έκπτωσησυνέπειας Οκτ 26", 30, 675),
      item("223 kWh x 0.12€/kWh", 113, 667),
      item("-26,76 €", 257, 667),
      item("zenith.gr", 30, 50),
    ],
  },
];
const valid: EnergyInput = {
  provider: "ΖeniΘ",
  supplyNumber: "TEST",
  invoiceNumber: "INV-1",
  billType: "actual",
  periodStart: "2026-09-19",
  periodEnd: "2026-10-18",
  billingDays: 29,
  issueDate: "2026-11-06",
  dueDate: "2026-11-26",
  kwh: 223,
  supplyCharges: 32.99,
  regulatedCharges: 22.12,
  taxes: 4.09,
  thirdPartyCharges: 19.89,
  adjustment: 0,
  currentTotal: 79.09,
  previousBalance: 0,
  amountDue: 79.09,
  fixedCharge: 9.57,
  discount: -26.76,
  documentHash: null,
  fileName: null,
  parserVersion: null,
};

test("Greek numeric formats distinguish thousands from decimals and preserve credits", () => {
  assert.equal(greekNumber("1.942"), 1942);
  assert.equal(greekNumber("1.942,12 €"), 1942.12);
  assert.equal(greekNumber("−26,76 €"), -26.76);
  assert.equal(greekNumber("9.90"), 9.9);
  assert.equal(greekNumber("RF123456"), undefined);
});
test("ZeniΘ maps summary totals and dates without mixing columns or tariff rates", () => {
  const sanitized = structuredClone(pages);
  sanitized[0].items.find((i) => i.text === "TEST-SUPPLY")!.text = "1-00000000-00";
  const { values, warnings } = parseZenith(sanitized);
  assert.equal(values.provider, "ΖeniΘ");
  assert.equal(values.kwh, 223);
  assert.equal(values.currentTotal, 79.09);
  assert.equal(values.amountDue, 79.09);
  assert.equal(values.periodStart, "2026-09-19");
  assert.equal(values.periodEnd, "2026-10-18");
  assert.equal(values.issueDate, "2026-11-06");
  assert.equal(values.dueDate, "2026-11-26");
  assert.equal(values.fixedCharge, 9.57);
  assert.equal(values.discount, -26.76);
  assert.equal(values.previousBalance, 0);
  assert.deepEqual(warnings, []);
  assert.deepEqual(validateBill(values), []);
});
test("unsupported layouts and missing outline totals require manual correction", () => {
  assert.deepEqual(
    parseZenith([{ width: 595, height: 842, items: [item("Unknown provider 100,00 €", 0, 500)] }])
      .warnings,
    ["unsupported"],
  );
  const missing = structuredClone(pages);
  missing[0].items = missing[0].items.filter((i) => i.y !== 484);
  const draft = parseZenith(missing);
  assert.equal(draft.values.currentTotal, undefined);
  assert.ok(draft.warnings.includes("incomplete"));
  assert.ok(validateBill(draft.values).includes("amounts"));
});

function earlierPages(): PdfTextPage[] {
  const labelValue = (label: string, value: string, y: number) => [
    item(label, 34, y),
    item(value, 272, y),
  ];
  return [
    {
      width: 595,
      height: 842,
      items: [
        item("Εκκαθαριστικός", 470, 748),
        item("www.zenith.gr", 40, 40),
        item("TEST-CUSTOMER", 41, 567),
        item("1-00000000-00", 115, 567),
        item("TEST-INVOICE", 187, 567),
        item("30/09/2026", 259, 567),
        item("22/10/2026", 325, 567),
        item("18/08/2026", 405, 567),
        item("-", 451, 567),
        item("19/09/2026", 459, 567),
        item("32", 536, 567),
        ...labelValue("Προμήθεια Ρεύματος ZeniΘ (€):", "48,04", 476),
        ...labelValue("Ρυθμιζόμενες Χρεώσεις (€):", "28,72", 468),
        ...labelValue("ΕΦΚ & Ειδ. Τέλος 5‰ (€):", "1,15", 443),
        ...labelValue("Αξία Φ.Π.Α. (€):", "4,65", 435),
        ...labelValue("Χρεώσεις Δήμου & ΕΡΤ (€):", "21,94", 427),
        item("104,50", 267, 377),
        item("20/10/2026", 69, 250),
        item("104,50 €", 210, 250),
      ],
    },
    {
      width: 595,
      height: 842,
      items: [
        ...labelValue("Σύνολο Κατανάλωσης Περιόδου (kWh):", "357", 709),
        ...labelValue("Πάγιο Τέλος (€):", "10,56", 704),
        item("Δίκτυο Μεταφοράς (€):", 299, 710),
        item("Έκπτωση συνέπειας Σεπ 26 (€):", 33, 688),
        item("357 kWh x", 188, 688),
        item("0,12 €/kWh =", 230, 688),
        item("-42,84", 273, 688),
        item("Σύνολο (€):", 299, 553),
        item("22,65", 548, 553),
        item("Ε.Τ.Μ.Ε.Α.Ρ. (€): 6,07", 34, 534),
      ],
    },
  ];
}

test("earlier two-page ZeniΘ layout reads horizontal identity, page-two kWh and split taxes", () => {
  const { values, warnings } = parseZenith(earlierPages());
  assert.equal(values.provider, "ΖeniΘ");
  assert.equal(values.invoiceNumber, "TEST-INVOICE");
  assert.equal(values.supplyNumber, "1-00000000-00");
  assert.equal(values.billType, "actual");
  assert.equal(values.issueDate, "2026-09-30");
  assert.equal(values.dueDate, "2026-10-20");
  assert.equal(values.periodStart, "2026-08-18");
  assert.equal(values.periodEnd, "2026-09-19");
  assert.equal(values.billingDays, 32);
  assert.equal(values.kwh, 357);
  assert.equal(values.supplyCharges, 48.04);
  assert.equal(values.regulatedCharges, 28.72);
  assert.equal(values.taxes, 5.8);
  assert.equal(values.thirdPartyCharges, 21.94);
  assert.equal(values.currentTotal, 104.5);
  assert.equal(values.amountDue, 104.5);
  assert.equal(values.previousBalance, 0);
  assert.equal(values.fixedCharge, 10.56);
  assert.equal(values.discount, -42.84);
  assert.deepEqual(warnings, []);
  assert.deepEqual(validateBill(values), []);
});

test("earlier layout distinguishes next meter reading from due date and detects carried balance", () => {
  const pages = earlierPages();
  pages[0].items.find((i) => i.text === "104,50 €")!.text = "124,50 €";
  const draft = parseZenith(pages);
  assert.equal(draft.values.dueDate, "2026-10-20");
  assert.equal(draft.values.previousBalance, 20);
  assert.equal(draft.values.currentTotal, 104.5);
  assert.equal(draft.values.amountDue, 124.5);
  assert.deepEqual(draft.warnings, ["balanceDerived"]);
  assert.deepEqual(validateBill(draft.values), []);
});

test("incomplete earlier headers remain unset rather than borrowing other dates", () => {
  const pages = earlierPages();
  pages[0].items = pages[0].items.filter((i) => i.text !== "18/08/2026");
  const draft = parseZenith(pages);
  assert.equal(draft.values.periodStart, undefined);
  assert.ok(draft.warnings.includes("incomplete"));
  assert.ok(validateBill(draft.values).includes("dates"));
});

test("estimated heading is not overridden by settlement references in the terms", () => {
  const pages = earlierPages();
  pages[0].items[0].text = "Έναντι";
  pages[1].items.push(item("επόμενο εκκαθαριστικό λογαριασμό", 431, 500));
  assert.equal(parseZenith(pages).values.billType, "estimated");
});
test("validation rejects mismatched totals, carried balances, invalid dates and precision", () => {
  assert.deepEqual(validateBill(valid), []);
  assert.ok(validateBill({ ...valid, currentTotal: 80 }).includes("sum"));
  assert.ok(validateBill({ ...valid, previousBalance: 100 }).includes("balance"));
  assert.ok(validateBill({ ...valid, periodEnd: "2026-02-30" }).includes("dates"));
  assert.ok(validateBill({ ...valid, taxes: 4.099 }).includes("amounts"));
  assert.ok(validateBill({ ...valid, discount: 26.76 }).includes("details"));
});
test("cost follows issue date while kWh is conserved across consumption months", () => {
  const a = energyAnalytics([{ id: "1", summary: valid }], 2026);
  assert.equal(a.months[10].cost, 79.09);
  assert.equal(a.months[8].cost, null);
  assert.ok(Math.abs(a.totalKwh - 223) < 1e-8);
  assert.equal(a.coveredDays, 30);
  assert.ok(a.months[8].kwh! > 0 && a.months[9].kwh! > 0);
  assert.equal(a.months[10].kwh, null);
  assert.equal(a.averageMonthly, 79.09);
  assert.equal(a.recordedMonths, 1);
});
test("actual readings replace overlapping estimates only for the same supply", () => {
  const estimate = { ...valid, billType: "estimated" as const, kwh: 100, invoiceNumber: "E1" };
  const a = energyAnalytics(
    [
      { id: "1", summary: estimate },
      { id: "2", summary: valid },
    ],
    2026,
  );
  assert.ok(Math.abs(a.totalKwh - 223) < 1e-8);
  assert.equal(a.estimatedKwh, 0);
  const other = energyAnalytics(
    [
      { id: "1", summary: { ...estimate, supplyNumber: "OTHER" } },
      { id: "2", summary: valid },
    ],
    2026,
  );
  assert.ok(Math.abs(other.totalKwh - 323) < 1e-8);
  assert.equal(other.coveredDays, 30);
});
test("cross-year periods preserve coverage and do not treat missing years as zero", () => {
  const bill = {
    id: "1",
    summary: {
      ...valid,
      periodStart: "2025-12-20",
      periodEnd: "2026-01-19",
      issueDate: "2026-02-01",
      kwh: 310,
    },
  };
  assert.deepEqual(billYears([bill]), [2026, 2025]);
  const previous = energyAnalytics([bill], 2025),
    current = energyAnalytics([bill], 2026);
  assert.ok(Math.abs(previous.totalKwh - 120) < 1e-8);
  assert.ok(Math.abs(current.totalKwh - 190) < 1e-8);
  assert.equal(previous.recordedMonths, 0);
  assert.equal(previous.averageMonthly, null);
  assert.equal(previous.totalKwh + current.totalKwh, 310);
});
