using System.Text.Json.Serialization;
using PortfolioTerminal.Portfolio.SecurityMetadata;
using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Portfolio.Activity;

public interface IActivityQueries
{
    Task<ActivityListResult> ListAsync(Guid userId, ActivityListFilter filter,
        CancellationToken cancellationToken = default);
}

public sealed record ActivityListFilter(TransactionListFilter Transactions,
    string Sort = "transaction_date", string Direction = "desc");

public sealed record ActivityListResult(IReadOnlyList<ActivityListItem> Rows, long Count);

public sealed record ActivityListItem(
    string Kind,
    Guid Id,
    string Action,
    [property: JsonPropertyName("transaction_currency")] string Currency,
    decimal? Shares,
    decimal? Price,
    [property: JsonPropertyName("transaction_date")] DateOnly Date,
    string? Notes,
    [property: JsonPropertyName("portfolio_id")] Guid? PortfolioId,
    [property: JsonPropertyName("security_listing_id")] Guid? SecurityListingId,
    decimal Amount,
    [property: JsonPropertyName("cash_used")] decimal CashUsed = 0m,
    [property: JsonPropertyName("fee_amount")] decimal FeeAmount = 0m,
    [property: JsonPropertyName("settles_to_cash")] bool SettlesToCash = false,
    SecurityMetadataView? Security = null);
