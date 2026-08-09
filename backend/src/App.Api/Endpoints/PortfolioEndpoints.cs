using System.Text.Json.Serialization;
using PortfolioTerminal.Api.Auth;
using PortfolioTerminal.Portfolio.Portfolios;
using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Api.Endpoints;

public static class PortfolioEndpoints
{
    public static IEndpointRouteBuilder MapPortfolioEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/portfolio")
            .WithTags("Portfolio")
            .RequireAuthorization();

        group.MapGet("/portfolios", async (
                IPortfolioQueries queries,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var portfolios = await queries.ListAsync(
                    currentUser.UserId,
                    cancellationToken);
                return TypedResults.Ok(portfolios);
            })
            .WithName("ListPortfolios");

        group.MapGet("/transactions", async Task<IResult> (
                int? page,
                int? pageSize,
                string? ticker,
                Guid? portfolioId,
                bool? unassignedPortfolio,
                string? assetType,
                string? currency,
                DateOnly? dateFrom,
                DateOnly? dateTo,
                ITransactionQueries queries,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                if ((page is null) != (pageSize is null) ||
                    page is < 1 ||
                    pageSize is < 1 or > 200)
                {
                    return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["pagination"] =
                        ["page and pageSize must be supplied together; page must be at least 1 and pageSize between 1 and 200."],
                    });
                }

                if (unassignedPortfolio is true && portfolioId is not null)
                {
                    return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["portfolio"] =
                        ["portfolioId and unassignedPortfolio cannot be used together."],
                    });
                }

                var offset = page is null
                    ? (long?)null
                    : (long)(page.Value - 1) * pageSize!.Value;
                if (offset > int.MaxValue)
                {
                    return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["pagination"] = ["The requested page is too large."],
                    });
                }

                var result = await queries.ListAsync(
                    currentUser.UserId,
                    new TransactionListFilter(
                        ticker,
                        portfolioId,
                        unassignedPortfolio ?? false,
                        assetType,
                        currency,
                        dateFrom,
                        dateTo,
                        (int?)offset,
                        pageSize),
                    cancellationToken);

                return TypedResults.Ok(TransactionListResponse.From(result));
            })
            .WithName("ListTransactions");

        return endpoints;
    }
}

public sealed record TransactionListResponse(
    IReadOnlyList<TransactionResponse> Rows,
    long Count)
{
    public static TransactionListResponse From(TransactionListResult result) =>
        new(result.Rows.Select(TransactionResponse.From).ToArray(), result.Count);
}

public sealed record TransactionResponse(
    Guid Id,
    string? Ticker,
    string Action,
    string? Name,
    [property: JsonPropertyName("asset_type")] string? AssetType,
    string? Market,
    string? Currency,
    decimal? Shares,
    decimal? Price,
    [property: JsonPropertyName("transaction_date")] DateOnly? TransactionDate,
    string? Notes,
    [property: JsonPropertyName("portfolio_id")] Guid? PortfolioId)
{
    public static TransactionResponse From(TransactionListItem transaction) =>
        new(
            transaction.Id,
            transaction.Ticker,
            transaction.Action,
            transaction.Name,
            transaction.AssetType,
            transaction.Market,
            transaction.Currency,
            transaction.Shares,
            transaction.Price,
            transaction.TransactionDate,
            transaction.Notes,
            transaction.PortfolioId);
}
