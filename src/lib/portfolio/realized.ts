import type { TransactionRow } from "./types";

export function calculateRealizedPnl(
  transactions: TransactionRow[],
  selectedPortfolioId: string,
  convert: (amount: number, from: string) => number,
) {
  const states = new Map<string, { quantity: number; basis: number }>();
  let realized = 0;
  const rows = transactions
    .filter(
      (row) =>
        (selectedPortfolioId === "__all__" ||
          (selectedPortfolioId === "__unassigned__"
            ? row.portfolio_id === null
            : row.portfolio_id === selectedPortfolioId)) &&
        (row.action === "buy" || row.action === "sell"),
    )
    .slice()
    .sort((left, right) => {
      const date = left.transaction_date.localeCompare(right.transaction_date);
      if (date) return date;
      const created =
        (left.created_at ? Date.parse(left.created_at) : 0) -
        (right.created_at ? Date.parse(right.created_at) : 0);
      return created || left.id.localeCompare(right.id);
    });
  for (const row of rows) {
    const key = `${row.security_listing_id}|${row.portfolio_id ?? ""}|${row.currency}`;
    const state = states.get(key) ?? { quantity: 0, basis: 0 };
    if (row.action === "buy") {
      state.quantity += Number(row.shares);
      state.basis += Number(row.shares) * Number(row.price) + Number(row.fee_amount ?? 0);
    } else {
      const average = state.quantity ? state.basis / state.quantity : 0;
      const disposed = average * Number(row.shares);
      realized += convert(
        Number(row.shares) * Number(row.price) - Number(row.fee_amount ?? 0) - disposed,
        row.currency,
      );
      state.quantity -= Number(row.shares);
      state.basis -= disposed;
      if (state.quantity === 0) state.basis = 0;
    }
    states.set(key, state);
  }
  return realized;
}
