import { emptyInput, validDate, type Draft, type PdfTextItem, type PdfTextPage } from "./types.ts";

export const ZENITH_PARSER = "zenith-monthly-v2";
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s–—-]+/g, "");

export function greekNumber(text: string): number | undefined {
  const clean = text.replace(/[€\s]/g, "").replace(/−/g, "-");
  if (!/^-?\d+(?:[.,]\d+)*$/.test(clean)) return undefined;
  const value = clean.includes(",")
    ? Number(clean.replace(/\./g, "").replace(",", "."))
    : /^-?\d{1,3}(?:\.\d{3})+$/.test(clean)
      ? Number(clean.replace(/\./g, ""))
      : Number(clean);
  return Number.isFinite(value) ? value : undefined;
}

function isoDate(text: string): string | undefined {
  const match = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return undefined;
  const value = `${match[3]}-${match[2]}-${match[1]}`;
  return validDate(value) ? value : undefined;
}

type Line = { text: string; y: number; items: PdfTextItem[] };
export function pdfLines(page: PdfTextPage, side?: "left" | "right"): Line[] {
  const rows: Line[] = [];
  const items = page.items.filter(
    (item) =>
      item.text.trim() &&
      (!side || (side === "left" ? item.x < page.width / 2 : item.x >= page.width / 2)),
  );
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    let line = rows.find((row) => Math.abs(row.y - item.y) <= 2);
    if (!line) {
      line = { text: "", y: item.y, items: [] };
      rows.push(line);
    }
    line.items.push(item);
  }
  return rows.map((row) => ({
    ...row,
    text: row.items
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(" "),
  }));
}
const moneyMatches = (text: string) =>
  [...text.matchAll(/[-−]?\d[\d.]*[,.]\d{2}\s*€/g)].map((match) => greekNumber(match[0]));

function billType(page: PdfTextPage) {
  // Read the heading, not references to settlement bills in the small-print terms.
  const heading = normalize(
    page.items
      .filter((item) => item.y > page.height * 0.75)
      .map((item) => item.text)
      .join(" "),
  );
  return heading.includes("εκκαθαριστικ")
    ? "actual"
    : heading.includes("εναντι")
      ? "estimated"
      : undefined;
}

function trailingAmount(line: Line | undefined): number | undefined {
  // The earlier template prints (€) in the label rather than after every value.
  const match = line?.text.match(/(?:^|\s)([-−]?\d[\d.]*[,.]\d{2})\s*€?\s*$/);
  return match ? greekNumber(match[1]) : undefined;
}

/** Earlier two-page template: identity is a horizontal row with outlined headings. */
function parseEarlierZenith(pages: PdfTextPage[]): Draft {
  const first = pages[0];
  const left = pdfLines(first, "left");
  const full = pdfLines(first);
  const values = { ...emptyInput(), provider: "ΖeniΘ", parserVersion: ZENITH_PARSER };
  const warnings: string[] = [];
  const summary = (label: string) =>
    left.find((line) => normalize(line.text).includes(normalize(label)));
  const supply = summary("Προμήθεια Ρεύματος");
  values.supplyCharges = trailingAmount(supply);
  values.regulatedCharges = trailingAmount(summary("Ρυθμιζόμενες Χρεώσεις"));
  const excise = trailingAmount(summary("ΕΦΚ & Ειδ. Τέλος"));
  const vat = trailingAmount(summary("Αξία Φ.Π.Α."));
  if (excise != null && vat != null) values.taxes = Math.round((excise + vat) * 100) / 100;
  const third = summary("Χρεώσεις Δήμου & ΕΡΤ");
  values.thirdPartyCharges = trailingAmount(third);
  values.billType = billType(first);

  const headers = full.filter(
    (line) =>
      line.y > first.height * 0.6 &&
      /\d-\d{8}-\d{2}/.test(line.text) &&
      (line.text.match(/\d{2}\/\d{2}\/\d{4}/g)?.length ?? 0) === 4,
  );
  if (headers.length === 1) {
    const items = headers[0].items;
    const supplyItem = items.find((item) => /^\d-\d{8}-\d{2}$/.test(item.text.trim()));
    const dateItems = items.filter((item) => /^\d{2}\/\d{2}\/\d{4}$/.test(item.text.trim()));
    values.supplyNumber = supplyItem?.text.trim();
    // Column order: supply, invoice, issue date, next meter reading, consumption dates, days.
    if (supplyItem && dateItems.length === 4) {
      const invoices = items.filter(
        (item) =>
          item.x > supplyItem.x &&
          item.x < dateItems[0].x &&
          /^[\p{L}\d-]+$/u.test(item.text.trim()),
      );
      if (invoices.length === 1) values.invoiceNumber = invoices[0].text.trim();
      values.issueDate = isoDate(dateItems[0].text);
      values.periodStart = isoDate(dateItems[2].text);
      values.periodEnd = isoDate(dateItems[3].text);
      const days = items.filter(
        (item) => item.x > dateItems[3].x && /^\d{1,3}$/.test(item.text.trim()),
      );
      if (days.length === 1) values.billingDays = Number(days[0].text.trim());
    }
  }
  const totals = left.filter(
    (line) =>
      third &&
      line.y < third.y - 5 &&
      line.y > third.y - first.height * 0.14 &&
      /^[-−\d\s.,€]+$/.test(line.text),
  );
  if (totals.length === 1) values.currentTotal = trailingAmount(totals[0]);
  // The payment box contains a due date and a separately printed payable amount.
  const payable = left.filter(
    (line) =>
      values.currentTotal != null &&
      third &&
      line.y < totals[0].y &&
      /\d{2}\/\d{2}\/\d{4}/.test(line.text) &&
      moneyMatches(line.text).length === 1,
  );
  if (payable.length === 1) {
    values.amountDue = moneyMatches(payable[0].text)[0];
    values.dueDate = isoDate(payable[0].text) ?? null;
  }
  if (values.currentTotal != null && values.amountDue != null) {
    values.previousBalance = Math.round((values.amountDue - values.currentTotal) * 100) / 100;
    if (values.previousBalance !== 0) warnings.push("balanceDerived");
  }
  const detail = pages[1] ? pdfLines(pages[1], "left") : [];
  const consumption = detail.find((line) =>
    normalize(line.text).includes(normalize("Σύνολο Κατανάλωσης Περιόδου")),
  );
  const kwh = consumption?.text.match(/\(\s*kwh\s*\)\s*:\s*([\d.,]+)/i);
  values.kwh = kwh ? greekNumber(kwh[1]) : undefined;
  values.fixedCharge =
    trailingAmount(
      detail.find((line) => normalize(line.text).includes(normalize("Πάγιο Τέλος"))),
    ) ?? null;
  values.discount =
    trailingAmount(
      detail.find((line) => normalize(line.text).includes(normalize("Έκπτωση συνέπειας"))),
    ) ?? null;
  if (values.discount != null && values.discount > 0) {
    values.discount = null;
    warnings.push("detailsMissing");
  }
  if (!values.invoiceNumber) warnings.push("invoiceMissing");
  if (
    values.kwh == null ||
    values.currentTotal == null ||
    values.amountDue == null ||
    values.supplyCharges == null ||
    values.regulatedCharges == null ||
    values.taxes == null ||
    values.thirdPartyCharges == null ||
    !values.issueDate ||
    !values.periodStart ||
    !values.periodEnd ||
    values.billingDays == null ||
    !values.supplyNumber
  )
    warnings.push("incomplete");
  return { values, warnings };
}

/** A position-aware adapter for the supplied monthly ZeniΘ layout. Never guesses from the largest number. */
export function parseZenith(pages: PdfTextPage[]): Draft {
  const values = emptyInput();
  const warnings: string[] = [];
  const allText = pages.flatMap((page) => page.items.map((item) => item.text)).join(" ");
  if (!/zenith\.gr|zeni[θΘ]|ζενιθ/i.test(allText)) return { values, warnings: ["unsupported"] };
  values.provider = "ΖeniΘ";
  values.parserVersion = ZENITH_PARSER;
  const first = pages[0];
  if (!first) return { values, warnings: ["noText"] };
  const left = pdfLines(first, "left");
  const right = pdfLines(first, "right");
  if (left.some((line) => normalize(line.text).includes(normalize("Προμήθεια Ρεύματος"))))
    return parseEarlierZenith(pages);
  const find = (label: string) =>
    left.find((line) => normalize(line.text).includes(normalize(label)));
  const after = (label: string) => {
    const line = find(label);
    if (!line) return "";
    // PDF text may place the label and its value in separate fragments or one fragment.
    const index = normalize(line.text).indexOf(normalize(label));
    if (index < 0) return "";
    const labelItem = line.items.find((item) => normalize(item.text).includes(normalize(label)));
    if (labelItem && normalize(labelItem.text) === normalize(label))
      return line.items
        .filter((item) => item.x > labelItem.x + labelItem.width - 1)
        .map((item) => item.text)
        .join(" ");
    // Greek labels can be joined without spaces; match by normalized character count.
    let count = 0;
    for (let i = 0; i < line.text.length; i++) {
      count += normalize(line.text[i]).length;
      if (count >= index + normalize(label).length) return line.text.slice(i + 1).trim();
    }
    return "";
  };
  values.supplyNumber = after("Αριθμός παροχής").match(/[\d-]{6,}/)?.[0];
  values.invoiceNumber = after("Α/Α λογαριασμού").trim() || null;
  values.issueDate = isoDate(after("Ημερομηνία έκδοσης"));
  const dates = after("Περίοδος κατανάλωσης").match(/\d{2}\/\d{2}\/\d{4}/g) ?? [];
  values.periodStart = isoDate(dates[0] ?? "");
  values.periodEnd = isoDate(dates[1] ?? "");
  values.billingDays = greekNumber(after("Ημέρες τιμολόγησης"));
  values.kwh = greekNumber(after("Ύψος κατανάλωσης").replace(/kwh/i, ""));
  values.billType = billType(first);
  const fields = {
    supplyCharges: "Χρέωση Προμήθειας",
    regulatedCharges: "Ρυθμιζόμενες Χρεώσεις",
    taxes: "Φόροι τέλη",
    thirdPartyCharges: "Χρεώσεις υπέρ Τρίτων",
  } as const;
  for (const [key, label] of Object.entries(fields)) {
    const line = find(label);
    const amounts = moneyMatches(line?.text ?? "");
    if (amounts.length === 1) values[key as keyof typeof fields] = amounts[0];
  }
  // The supplied template draws some headings as outlines. Bind standalone totals to
  // the summary block's position, and cross-check against the independently printed payable total.
  const bottom = find(fields.thirdPartyCharges);
  const totals = left.filter(
    (line) =>
      bottom &&
      line.y < bottom.y - 5 &&
      line.y > bottom.y - first.height * 0.14 &&
      /^[-−\d\s.,€]+$/.test(line.text),
  );
  if (totals.length === 1) values.currentTotal = moneyMatches(totals[0].text)[0];
  const payable = right.filter(
    (line) =>
      line.y > first.height * 0.5 &&
      line.y < first.height * 0.7 &&
      moneyMatches(line.text).length === 1,
  );
  if (payable.length === 1) {
    values.amountDue = moneyMatches(payable[0].text)[0];
    const dueDates = right
      .filter((line) => line.y < payable[0].y && line.y > payable[0].y - 65)
      .flatMap((line) => line.text.match(/\d{2}\/\d{2}\/\d{4}/g) ?? []);
    if (dueDates.length === 1) values.dueDate = isoDate(dueDates[0]) ?? null;
  }
  if (values.currentTotal != null && values.amountDue != null) {
    values.previousBalance = Math.round((values.amountDue - values.currentTotal) * 100) / 100;
    if (values.previousBalance !== 0) warnings.push("balanceDerived");
  }
  const detail = pages[1] ? pdfLines(pages[1], "left") : [];
  const detailAmount = (label: string) => {
    const row = detail.find((line) => normalize(line.text).includes(normalize(label)));
    if (!row) return null;
    const standaloneAmounts = (line: Line) =>
      line.items.flatMap((item) =>
        /^[-−\d\s.,]+\s*€$/.test(item.text.trim()) ? moneyMatches(item.text) : [],
      );
    const following = detail.find(
      (line) => line.y < row.y && row.y - line.y < 18 && standaloneAmounts(line).length === 1,
    );
    return (
      standaloneAmounts(row).at(-1) ??
      (following ? standaloneAmounts(following).at(-1) : null) ??
      null
    );
  };
  values.fixedCharge = detailAmount("Πάγιο Τέλος");
  values.discount = detailAmount("Έκπτωση συνέπειας");
  if (values.discount != null && values.discount > 0) {
    values.discount = null;
    warnings.push("detailsMissing");
  }
  if (!values.invoiceNumber) warnings.push("invoiceMissing");
  if (
    values.kwh == null ||
    values.currentTotal == null ||
    values.amountDue == null ||
    Object.keys(fields).some((key) => values[key as keyof typeof fields] == null)
  )
    warnings.push("incomplete");
  return { values, warnings: [...new Set(warnings)] };
}
