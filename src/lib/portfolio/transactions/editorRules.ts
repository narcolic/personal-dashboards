export type EditorValidationInput = {
  ticker: string;
  portfolio_id?: string | null;
  transaction_date: string;
  shares: string;
  price: string;
  fee_amount: string;
  notes?: string | null;
  action: string;
};

export function validateTransactionDraft(value: EditorValidationInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!value.portfolio_id) errors.portfolio_id = "portfolioRequired";
  if (!/^[A-Za-z0-9.\-^=:_]{1,32}$/.test(value.ticker.trim())) errors.ticker = "tickerInvalid";
  const date = new Date(`${value.transaction_date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value.transaction_date) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value.transaction_date
  )
    errors.transaction_date = "dateRequired";
  for (const field of ["shares", "price", "fee_amount"] as const) {
    const raw = value[field];
    const number = Number(raw);
    if (
      (field !== "fee_amount" && raw.trim() === "") ||
      !Number.isFinite(number) ||
      number < 0 ||
      number > 1e9
    )
      errors[field] = "numberInvalid";
  }
  if (
    value.action === "sell" &&
    Number(value.fee_amount) > Number(value.shares) * Number(value.price)
  )
    errors.fee_amount = "feeExceedsSale";
  if ((value.notes?.trim().length ?? 0) > 500) errors.notes = "notesTooLong";
  return errors;
}
