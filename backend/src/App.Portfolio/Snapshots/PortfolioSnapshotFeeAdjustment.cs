namespace PortfolioTerminal.Portfolio.Snapshots;

// Adapt fee-inclusive v2 snapshots without replacing their historical quotes or FX rates.
public static class PortfolioSnapshotFeeAdjustment
{
    public static PortfolioSnapshotListItem Apply(
        PortfolioSnapshotListItem snapshot, IReadOnlyList<SnapshotTransaction> history)
    {
        if (snapshot.AccountingVersion != 2) return snapshot;
        var effects = new Dictionary<string, Effect>(StringComparer.OrdinalIgnoreCase);
        foreach (var group in history
            .Where(row => row.UserId == snapshot.UserId && row.TransactionDate <= snapshot.SnapshotDate &&
                (snapshot.Scope == "total" || row.PortfolioId == snapshot.PortfolioId) &&
                (row.Action == "buy" || row.Action == "sell"))
            .GroupBy(row => (row.SecurityListingId, row.PortfolioId, Currency: (row.Currency ?? "USD").ToUpperInvariant())))
        {
            decimal quantity = 0m, remainingFees = 0m;
            var effect = effects.GetValueOrDefault(group.Key.Currency) ?? new Effect();
            foreach (var row in group.OrderBy(row => row.TransactionDate)
                .ThenBy(row => row.CreatedAt ?? DateTimeOffset.MinValue).ThenBy(row => row.Id))
            {
                if (row.Action == "buy")
                {
                    quantity += row.Shares;
                    remainingFees += row.FeeAmount;
                    var excessCash = Math.Max(0m, row.CashUsed - row.Shares * row.Price);
                    effect.Cash += excessCash;
                    if (row.TransactionDate == snapshot.SnapshotDate)
                        effect.Flow += excessCash - row.FeeAmount;
                }
                else
                {
                    var disposedFees = quantity == 0m ? 0m : remainingFees / quantity * row.Shares;
                    quantity -= row.Shares;
                    remainingFees -= disposedFees;
                    if (quantity == 0m) remainingFees = 0m;
                    effect.Realized += disposedFees + row.FeeAmount;
                    if (row.SettlesToCash) effect.Cash += row.FeeAmount;
                }
            }
            effect.Basis += remainingFees;
            effects[group.Key.Currency] = effect;
        }
        decimal Sum(string currency, Func<Effect, decimal> select) => effects.Sum(item =>
            Convert(select(item.Value), item.Key, currency));
        decimal Convert(decimal amount, string from, string to)
        {
            if (amount == 0m || from == to) return amount;
            decimal Rate(string code) => code == "USD" ? 1m :
                snapshot.FxMetadata.GetProperty("rates").GetProperty(code).GetDecimal();
            return amount / Rate(from) * Rate(to);
        }
        var basisEur = Sum("EUR", e => e.Basis);
        var basisUsd = Sum("USD", e => e.Basis);
        var cashEur = Sum("EUR", e => e.Cash);
        var cashUsd = Sum("USD", e => e.Cash);
        var realizedEur = Sum("EUR", e => e.Realized);
        var realizedUsd = Sum("USD", e => e.Realized);
        return snapshot with
        {
            CostBasisEur = snapshot.CostBasisEur - basisEur,
            CostBasisUsd = snapshot.CostBasisUsd - basisUsd,
            UnrealizedEur = snapshot.UnrealizedEur + basisEur,
            UnrealizedUsd = snapshot.UnrealizedUsd + basisUsd,
            CashBalanceEur = snapshot.CashBalanceEur + cashEur,
            CashBalanceUsd = snapshot.CashBalanceUsd + cashUsd,
            TotalValueEur = snapshot.TotalValueEur + cashEur,
            TotalValueUsd = snapshot.TotalValueUsd + cashUsd,
            RealizedEur = snapshot.RealizedEur + realizedEur,
            RealizedUsd = snapshot.RealizedUsd + realizedUsd,
            TotalPnlEur = snapshot.TotalPnlEur + basisEur + realizedEur,
            TotalPnlUsd = snapshot.TotalPnlUsd + basisUsd + realizedUsd,
            ExternalFlowEur = snapshot.ExternalFlowEur + Sum("EUR", e => e.Flow),
            ExternalFlowUsd = snapshot.ExternalFlowUsd + Sum("USD", e => e.Flow),
            AccountingVersion = 3,
        };
    }

    private sealed class Effect
    {
        public decimal Basis;
        public decimal Cash;
        public decimal Realized;
        public decimal Flow;
    }
}
