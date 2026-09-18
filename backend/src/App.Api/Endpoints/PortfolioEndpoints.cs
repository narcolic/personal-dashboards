using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using PortfolioTerminal.Api.Auth;
using PortfolioTerminal.Portfolio;
using PortfolioTerminal.Portfolio.Holdings;
using PortfolioTerminal.Portfolio.Cash;
using PortfolioTerminal.Portfolio.MarketData;
using PortfolioTerminal.Portfolio.Portfolios;
using PortfolioTerminal.Portfolio.SecurityMetadata;
using PortfolioTerminal.Portfolio.Snapshots;
using PortfolioTerminal.Portfolio.TickerCatalog;
using PortfolioTerminal.Portfolio.Transactions;
using PortfolioTerminal.Portfolio.Activity;

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

        group.MapPost("/portfolios", CreatePortfolioAsync)
            .WithName("CreatePortfolio");
        group.MapDelete("/portfolios/{portfolioId:guid}", DeletePortfolioAsync)
            .WithName("DeletePortfolio");

        group.MapGet("/ticker-catalog", async (
                ITickerCatalogQueries queries,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var items = await queries.ListAsync(currentUser.UserId, cancellationToken);
                return TypedResults.Ok(items.Select(TickerCatalogResponse.From));
            })
            .WithName("ListTickerCatalog");

        group.MapPost("/security-listings/resolve", ResolveSecurityListingAsync)
            .WithName("ResolveSecurityListing");

        group.MapGet("/snapshots", async Task<IResult> (
                int? limit,
                IPortfolioSnapshotQueries queries,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var requestedLimit = limit ?? 1000;
                if (requestedLimit is < 1 or > 1000)
                {
                    return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["limit"] = ["Limit must be between 1 and 1000."],
                    });
                }

                var items = await queries.ListAsync(
                    currentUser.UserId,
                    requestedLimit,
                    cancellationToken);
                return TypedResults.Ok(items.Select(PortfolioSnapshotResponse.From));
            })
            .WithName("ListPortfolioSnapshots");

        group.MapGet("/holdings", async (
                IPortfolioHoldingQueries queries,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var holdings = await queries.ListAsync(
                    currentUser.UserId,
                    cancellationToken);
                return TypedResults.Ok(holdings.Select(PortfolioHoldingResponse.From));
            })
            .WithName("ListPortfolioHoldings");

        group.MapGet("/cash", async (
                DateOnly? asOf,
                IPortfolioCashQueries queries,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            TypedResults.Ok(await queries.ListAsync(
                currentUser.UserId, asOf, cancellationToken)))
            .WithName("ListPortfolioCash");

        group.MapPost("/cash/withdrawals", WithdrawCashAsync)
            .WithName("WithdrawPortfolioCash");

        group.MapGet("/quotes", async Task<IResult> (
                string? symbols,
                IQuoteService service,
                CancellationToken cancellationToken) =>
            {
                var requested = SplitDistinct(symbols, value => value.ToUpperInvariant());
                if (requested.Length > 100 || requested.Any(value => value.Length > 32))
                {
                    return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["symbols"] = ["Supply at most 100 symbols, each no longer than 32 characters."],
                    });
                }

                return TypedResults.Ok(await service.GetAsync(requested, cancellationToken));
            })
            .WithName("GetPortfolioQuotes");

        group.MapGet("/fx-rates", async Task<IResult> (
                string? from,
                IFxRateService service,
                CancellationToken cancellationToken) =>
            {
                var baseCurrency = string.IsNullOrWhiteSpace(from)
                    ? "USD"
                    : from.Trim().ToUpperInvariant();
                if (!Regex.IsMatch(baseCurrency, "^[A-Z]{3,5}$"))
                {
                    return TypedResults.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["from"] = ["Currency must contain 3 to 5 letters."],
                    });
                }

                return Results.Json(await service.GetAsync(baseCurrency, cancellationToken));
            })
            .WithName("GetPortfolioFxRates");

        group.MapGet("/market-status", async (
                string? exchanges,
                IMarketStatusService service,
                CancellationToken cancellationToken) =>
            {
                var requested = SplitDistinct(exchanges, NormalizeExchangeCode);
                return TypedResults.Ok(await service.GetAsync(requested, cancellationToken));
            })
            .WithName("GetPortfolioMarketStatus");

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

        group.MapGet("/activity", ListActivityAsync).WithName("ListPortfolioActivity");

        group.MapPost("/transactions", CreateTransactionAsync)
            .WithName("CreateTransaction");
        group.MapPut("/transactions/{transactionId:guid}", UpdateTransactionAsync)
            .WithName("UpdateTransaction");
        group.MapDelete("/transactions/{transactionId:guid}", DeleteTransactionAsync)
            .WithName("DeleteTransaction");
        group.MapPost("/transactions/bulk-delete", DeleteTransactionsAsync)
            .WithName("DeleteTransactions");
        group.MapPost("/transactions/import", ImportTransactionsAsync)
            .WithName("ImportTransactions");

        return endpoints;
    }

    private static string[] SplitDistinct(
        string? value,
        Func<string, string> normalize) =>
        [.. (value ?? string.Empty)
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(normalize)
        .Where(item => item.Length > 0)
        .Distinct(StringComparer.OrdinalIgnoreCase)];

    private static string NormalizeExchangeCode(string value) =>
        value.Trim().ToLowerInvariant() switch
        {
            "xams" => "ams",
            "xetr" => "xetra",
            "xlon" => "lse",
            var code => code,
        };

    private static async Task<IResult> CreatePortfolioAsync(
        PortfolioMutationRequest request,
        IPortfolioCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (Validate(request) is { Count: > 0 } errors)
        {
            return Results.ValidationProblem(errors);
        }

        var result = await commands.CreateAsync(
            currentUser.UserId,
            request.ToMutation(),
            cancellationToken);
        return result.Status == PortfolioMutationStatus.Success
            ? TypedResults.Created(
                $"/api/portfolio/portfolios/{result.Id}",
                new PortfolioMutationResponse(result.Id!.Value))
            : ToErrorResult(result);
    }

    private static async Task<IResult> DeletePortfolioAsync(
        Guid portfolioId,
        IPortfolioCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken) =>
        ToDeleteResult(await commands.DeleteAsync(
            currentUser.UserId,
            portfolioId,
            cancellationToken));

    private static async Task<IResult> WithdrawCashAsync(
        CashWithdrawalRequest request,
        IPortfolioCashCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.Currency) ||
            !Regex.IsMatch(request.Currency.Trim(), "^[A-Za-z]{3,5}$"))
            errors["currency"] = ["Currency must contain 3 to 5 letters."];
        if (request.Amount <= 0m || request.Amount > 1_000_000_000m)
            errors["amount"] = ["Amount must be greater than zero and no more than 1,000,000,000."];
        if (request.WithdrawalDate == default)
            errors["withdrawal_date"] = ["Withdrawal date is required."];
        if (request.Notes?.Trim().Length > 500)
            errors["notes"] = ["Notes must not exceed 500 characters."];
        if (errors.Count > 0) return Results.ValidationProblem(errors);

        var result = await commands.WithdrawAsync(
            currentUser.UserId,
            new CashWithdrawalMutation(
                request.PortfolioId,
                request.Currency,
                request.Amount,
                request.WithdrawalDate,
                request.Notes),
            cancellationToken);
        return result.Status == PortfolioMutationStatus.Success
            ? TypedResults.Created(
                $"/api/portfolio/cash/withdrawals/{result.Id}",
                new PortfolioMutationResponse(result.Id!.Value))
            : ToErrorResult(result);
    }

    private static async Task<IResult> CreateTransactionAsync(
        TransactionMutationRequest request,
        ITransactionCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (Validate(request) is { Count: > 0 } errors)
        {
            return Results.ValidationProblem(errors);
        }

        var result = await commands.CreateAsync(
            currentUser.UserId,
            request.ToMutation(),
            cancellationToken);
        return result.Status == PortfolioMutationStatus.Success
            ? TypedResults.Created(
                $"/api/portfolio/transactions/{result.Id}",
                new PortfolioMutationResponse(result.Id!.Value))
            : ToErrorResult(result);
    }

    private static async Task<IResult> UpdateTransactionAsync(
        Guid transactionId,
        TransactionMutationRequest request,
        ITransactionCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (Validate(request) is { Count: > 0 } errors)
        {
            return Results.ValidationProblem(errors);
        }

        var result = await commands.UpdateAsync(
            currentUser.UserId,
            transactionId,
            request.ToMutation(),
            cancellationToken);
        return result.Status == PortfolioMutationStatus.Success
            ? TypedResults.Ok(new PortfolioMutationResponse(transactionId))
            : ToErrorResult(result);
    }

    private static async Task<IResult> DeleteTransactionAsync(
        Guid transactionId,
        ITransactionCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken) =>
        ToDeleteResult(await commands.DeleteAsync(
            currentUser.UserId,
            transactionId,
            cancellationToken));

    private static async Task<IResult> DeleteTransactionsAsync(
        TransactionBulkDeleteRequest request,
        ITransactionCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (request.Ids is not { Count: > 0 and <= 200 })
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["ids"] = ["Supply between 1 and 200 transaction IDs."],
            });
        }

        var result = await commands.DeleteManyAsync(
            currentUser.UserId,
            request.Ids,
            cancellationToken);
        return result.Status == PortfolioMutationStatus.Success
            ? TypedResults.Ok(new PortfolioBulkMutationResponse(result.AffectedCount))
            : ToErrorResult(result);
    }

    private static async Task<IResult> ImportTransactionsAsync(
        TransactionImportRequest request,
        ITransactionCommands commands,
        ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        if (Validate(request) is { Count: > 0 } errors)
        {
            return Results.ValidationProblem(errors);
        }

        var result = await commands.ImportAsync(
            currentUser.UserId,
            request.ToMutation(),
            cancellationToken);
        return result.Status == PortfolioMutationStatus.Success
            ? TypedResults.Ok(new PortfolioImportResponse(result.AffectedCount))
            : ToErrorResult(result);
    }

    private static IResult ToDeleteResult(PortfolioMutationResult result) =>
        result.Status == PortfolioMutationStatus.Success
            ? TypedResults.NoContent()
            : ToErrorResult(result);

    private static IResult ToErrorResult(PortfolioMutationResult result) =>
        result.Status switch
        {
            PortfolioMutationStatus.NotFound => Results.Problem(
                statusCode: StatusCodes.Status404NotFound,
                title: "Resource not found.",
                detail: result.Detail),
            PortfolioMutationStatus.Conflict => Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "The request conflicts with existing data.",
                detail: result.Detail),
            _ => Results.Problem(statusCode: StatusCodes.Status500InternalServerError),
        };

    private static Dictionary<string, string[]> Validate(PortfolioMutationRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.Name)) errors["name"] = ["Name is required."];
        else if (request.Name.Trim().Length > 80) errors["name"] = ["Name must not exceed 80 characters."];
        if (request.Broker?.Trim().Length > 80) errors["broker"] = ["Broker must not exceed 80 characters."];
        if (request.Notes?.Trim().Length > 500) errors["notes"] = ["Notes must not exceed 500 characters."];
        return errors;
    }

    private static Dictionary<string, string[]> Validate(TransactionMutationRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.PortfolioId is null || request.PortfolioId == Guid.Empty)
            errors["portfolio_id"] = ["Portfolio is required."];
        var action = request.Action?.Trim();
        if (request.SecurityListingId == Guid.Empty)
            errors["security_listing_id"] = ["Security listing is required."];
        if (!TransactionActions.Contains(action ?? string.Empty))
            errors["action"] = ["Action is invalid."];
        if (string.IsNullOrWhiteSpace(request.TransactionCurrency) ||
            request.TransactionCurrency.Trim().Length is < 3 or > 5)
            errors["transaction_currency"] = ["Transaction currency must contain 3 to 5 characters."];
        if (request.Shares is < 0 or > 1_000_000_000m)
            errors["shares"] = ["Shares are outside the allowed range."];
        if (request.Price is < 0 or > 1_000_000_000m)
            errors["price"] = ["Price is outside the allowed range."];
        if (request.FeeAmount is < 0 or > 1_000_000_000m)
            errors["fee_amount"] = ["Fee amount is outside the allowed range."];
        if (action?.Equals("sell", StringComparison.OrdinalIgnoreCase) == true &&
            request.FeeAmount > request.Shares * request.Price)
            errors["fee_amount"] = ["Fee amount cannot exceed sale proceeds."];
        if (action?.Equals("buy", StringComparison.OrdinalIgnoreCase) != true && request.UseAvailableCash)
            errors["use_available_cash"] = ["Available cash can only fund a BUY."];
        if (request.TransactionDate == default)
            errors["transaction_date"] = ["Transaction date is required."];
        if (request.Notes?.Trim().Length > 500)
            errors["notes"] = ["Notes must not exceed 500 characters."];
        return errors;
    }

    private static async Task<IResult> ListActivityAsync(
        int? page, int? pageSize, string? ticker, Guid? portfolioId, bool? unassignedPortfolio,
        string? assetType, string? currency, DateOnly? dateFrom, DateOnly? dateTo,
        string? sort, string? direction, IActivityQueries queries, ICurrentUser currentUser,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        if ((page is null) != (pageSize is null) || page is < 1 || pageSize is < 1 or > 200)
            errors["pagination"] = ["Supply page and pageSize together; page must be positive and pageSize between 1 and 200."];
        if (unassignedPortfolio is true && portfolioId is not null)
            errors["portfolio"] = ["portfolioId and unassignedPortfolio cannot be used together."];
        if (dateFrom > dateTo) errors["date"] = ["Date From cannot be after Date To."];
        sort ??= "transaction_date";
        direction ??= "desc";
        if (!ActivityQueries.SortColumns.ContainsKey(sort)) errors["sort"] = ["Sort column is invalid."];
        if (direction is not ("asc" or "desc")) errors["direction"] = ["Direction must be asc or desc."];
        var offset = page.HasValue && pageSize.HasValue ? (long)(page.Value - 1) * pageSize.Value : 0;
        if (offset > int.MaxValue) errors["pagination"] = ["The requested page is too large."];
        if (errors.Count > 0) return TypedResults.ValidationProblem(errors);
        var result = await queries.ListAsync(currentUser.UserId,
            new ActivityListFilter(new TransactionListFilter(ticker, portfolioId,
                unassignedPortfolio ?? false, assetType, currency, dateFrom, dateTo,
                (int)offset, pageSize), sort, direction), cancellationToken);
        return TypedResults.Ok(result);
    }

    private static async Task<IResult> ResolveSecurityListingAsync(
        SecurityListingResolutionRequestBody request,
        ISecurityListingResolver resolver,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();
        var symbol = request.Symbol?.Trim() ?? string.Empty;
        var securityType = request.SecurityType?.Trim() ?? string.Empty;
        if (symbol.Length is < 1 or > 32 ||
            !Regex.IsMatch(symbol, @"^[A-Za-z0-9.\-^=:_]+$"))
            errors["symbol"] = ["Symbol is invalid."];
        if (!AssetTypes.Contains(securityType))
            errors["security_type"] = ["Security type is invalid."];
        if (request.Name?.Trim().Length > 120)
            errors["name"] = ["Name must not exceed 120 characters."];
        if (request.Market?.Trim().Length > 40)
            errors["market"] = ["Market must not exceed 40 characters."];
        if (request.TradingCurrency?.Trim().Length is > 5)
            errors["trading_currency"] = ["Trading currency must not exceed 5 characters."];
        if (errors.Count > 0) return Results.ValidationProblem(errors);

        var resolution = await resolver.ResolveAsync(
            new SecurityListingResolutionRequest(
                null, symbol, request.Name, securityType,
                request.Market, request.TradingCurrency),
            cancellationToken);
        return TypedResults.Ok(new SecurityListingResolutionResponse(
            resolution.ListingId, resolution.Symbol, resolution.Created));
    }

    private static Dictionary<string, string[]> Validate(TransactionImportRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if (request.Rows is not { Count: > 0 and <= 5000 })
        {
            errors["rows"] = ["Supply between 1 and 5000 transaction rows."];
            return errors;
        }
        if (request.ImportedPortfolioNotes?.Trim().Length > 500)
        {
            errors["importedPortfolioNotes"] = ["Imported portfolio notes must not exceed 500 characters."];
        }

        for (var index = 0; index < request.Rows.Count; index++)
        {
            var row = request.Rows[index];
            var prefix = $"rows[{index}].";
            if (row is null)
            {
                errors[$"{prefix}row"] = ["Transaction row is required."];
                continue;
            }
            ValidateTransaction(
                row.Ticker,
                "buy",
                row.Name,
                row.AssetType,
                null,
                row.Currency,
                row.Shares,
                row.Price,
                row.TransactionDate,
                row.Notes,
                prefix,
                errors,
                allowZeroShares: false);
            if (string.IsNullOrWhiteSpace(row.PortfolioName))
            {
                errors[$"{prefix}portfolio_name"] = ["Portfolio name is required."];
            }
            else if (row.PortfolioName.Trim().Length > 80)
            {
                errors[$"{prefix}portfolio_name"] = ["Portfolio name must not exceed 80 characters."];
            }
        }
        return errors;
    }

    private static void ValidateTransaction(
        string ticker,
        string action,
        string? name,
        string assetType,
        string? market,
        string currency,
        decimal shares,
        decimal price,
        DateOnly transactionDate,
        string? notes,
        string prefix,
        Dictionary<string, string[]> errors,
        bool allowZeroShares)
    {
        var normalizedTicker = ticker?.Trim() ?? string.Empty;
        if (normalizedTicker.Length is < 1 or > 32 ||
            !Regex.IsMatch(normalizedTicker, @"^[A-Za-z0-9.\-^=:_]+$"))
        {
            errors[$"{prefix}ticker"] = ["Ticker is invalid."];
        }
        if (!TransactionActions.Contains(action?.Trim() ?? string.Empty)) errors[$"{prefix}action"] = ["Action is invalid."];
        if (!AssetTypes.Contains(assetType?.Trim() ?? string.Empty)) errors[$"{prefix}asset_type"] = ["Asset type is invalid."];
        if (name?.Trim().Length > 120) errors[$"{prefix}name"] = ["Name must not exceed 120 characters."];
        if (market?.Trim().Length > 40) errors[$"{prefix}market"] = ["Market must not exceed 40 characters."];
        if (string.IsNullOrWhiteSpace(currency) || currency.Trim().Length is < 3 or > 5)
            errors[$"{prefix}currency"] = ["Currency must contain 3 to 5 characters."];
        if (shares < 0 || (!allowZeroShares && shares == 0) || shares > 1_000_000_000m) errors[$"{prefix}shares"] = ["Shares are outside the allowed range."];
        if (price is < 0 or > 1_000_000_000m) errors[$"{prefix}price"] = ["Price is outside the allowed range."];
        if (transactionDate == default) errors[$"{prefix}transaction_date"] = ["Transaction date is required."];
        if (notes?.Trim().Length > 500) errors[$"{prefix}notes"] = ["Notes must not exceed 500 characters."];
    }

    private static readonly HashSet<string> TransactionActions =
        new(["buy", "sell", "dividend", "fee"], StringComparer.OrdinalIgnoreCase);

    private static readonly HashSet<string> AssetTypes =
        new(["stock", "etf", "crypto", "bond", "fund", "other"], StringComparer.OrdinalIgnoreCase);
}

public sealed record PortfolioMutationResponse(Guid Id);

public sealed record SecurityListingResolutionRequestBody(
    string Symbol,
    string? Name,
    [property: JsonPropertyName("security_type")] string SecurityType,
    string? Market,
    [property: JsonPropertyName("trading_currency")] string? TradingCurrency);

public sealed record SecurityListingResolutionResponse(
    [property: JsonPropertyName("listing_id")] Guid ListingId,
    string Symbol,
    bool Created);

public sealed record PortfolioHoldingResponse(
    string Id,
    [property: JsonPropertyName("transaction_currency")] string TransactionCurrency,
    decimal Shares,
    [property: JsonPropertyName("avg_cost")] decimal AvgCost,
    string? Notes,
    [property: JsonPropertyName("portfolio_id")] Guid? PortfolioId,
    [property: JsonPropertyName("tx_count")] int TransactionCount,
    [property: JsonPropertyName("first_date")] DateOnly? FirstDate,
    [property: JsonPropertyName("last_date")] DateOnly? LastDate,
    [property: JsonPropertyName("security_listing_id")] Guid SecurityListingId,
    SecurityMetadataView Security)
{
    public static PortfolioHoldingResponse From(PortfolioHolding holding) =>
        new(holding.Id, holding.Currency, holding.Shares, holding.AvgCost,
            holding.Notes, holding.PortfolioId, holding.TransactionCount,
            holding.FirstDate, holding.LastDate,
            holding.SecurityListingId ?? throw new InvalidOperationException("Holding listing is required."),
            holding.Security ?? throw new InvalidOperationException("Holding security metadata is required."));
}

public sealed record TickerCatalogResponse(
    Guid Id,
    [property: JsonPropertyName("user_id")] Guid UserId,
    [property: JsonPropertyName("is_active")] bool IsActive,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt,
    [property: JsonPropertyName("updated_at")] DateTimeOffset UpdatedAt,
    [property: JsonPropertyName("security_listing_id")] Guid SecurityListingId,
    SecurityMetadataView Security)
{
    public static TickerCatalogResponse From(TickerCatalogListItem item) =>
        new(item.Id, item.UserId, item.IsActive, item.CreatedAt, item.UpdatedAt,
            item.SecurityListingId,
            item.Security ?? throw new InvalidOperationException("Catalog security metadata is required."));
}

public sealed record PortfolioSnapshotResponse(
    Guid Id,
    [property: JsonPropertyName("user_id")] Guid UserId,
    [property: JsonPropertyName("snapshot_date")] DateOnly SnapshotDate,
    [property: JsonPropertyName("snapshot_at")] DateTimeOffset SnapshotAt,
    string Scope,
    [property: JsonPropertyName("scope_key")] string ScopeKey,
    [property: JsonPropertyName("portfolio_id")] Guid? PortfolioId,
    [property: JsonPropertyName("portfolio_name")] string? PortfolioName,
    [property: JsonPropertyName("market_value_eur")] decimal MarketValueEur,
    [property: JsonPropertyName("market_value_usd")] decimal MarketValueUsd,
    [property: JsonPropertyName("cost_basis_eur")] decimal CostBasisEur,
    [property: JsonPropertyName("cost_basis_usd")] decimal CostBasisUsd,
    [property: JsonPropertyName("unrealized_eur")] decimal UnrealizedEur,
    [property: JsonPropertyName("unrealized_usd")] decimal UnrealizedUsd,
    [property: JsonPropertyName("quote_metadata")] JsonElement QuoteMetadata,
    [property: JsonPropertyName("fx_metadata")] JsonElement FxMetadata,
    [property: JsonPropertyName("created_at")] DateTimeOffset CreatedAt,
    [property: JsonPropertyName("updated_at")] DateTimeOffset UpdatedAt,
    [property: JsonPropertyName("cash_balance_eur")] decimal CashBalanceEur,
    [property: JsonPropertyName("cash_balance_usd")] decimal CashBalanceUsd,
    [property: JsonPropertyName("total_value_eur")] decimal TotalValueEur,
    [property: JsonPropertyName("total_value_usd")] decimal TotalValueUsd,
    [property: JsonPropertyName("realized_eur")] decimal RealizedEur,
    [property: JsonPropertyName("realized_usd")] decimal RealizedUsd,
    [property: JsonPropertyName("total_pnl_eur")] decimal TotalPnlEur,
    [property: JsonPropertyName("total_pnl_usd")] decimal TotalPnlUsd,
    [property: JsonPropertyName("external_flow_eur")] decimal ExternalFlowEur,
    [property: JsonPropertyName("external_flow_usd")] decimal ExternalFlowUsd,
    [property: JsonPropertyName("accounting_version")] short AccountingVersion)
{
    public static PortfolioSnapshotResponse From(PortfolioSnapshotListItem item) =>
        new(item.Id, item.UserId, item.SnapshotDate, item.SnapshotAt,
            item.Scope, item.ScopeKey, item.PortfolioId, item.PortfolioName,
            item.MarketValueEur, item.MarketValueUsd,
            item.CostBasisEur, item.CostBasisUsd,
            item.UnrealizedEur, item.UnrealizedUsd,
            item.QuoteMetadata, item.FxMetadata, item.CreatedAt, item.UpdatedAt,
            item.CashBalanceEur, item.CashBalanceUsd,
            item.TotalValueEur, item.TotalValueUsd,
            item.RealizedEur, item.RealizedUsd,
            item.TotalPnlEur, item.TotalPnlUsd,
            item.ExternalFlowEur, item.ExternalFlowUsd,
            item.AccountingVersion);
}

public sealed record PortfolioBulkMutationResponse(int Deleted);

public sealed record PortfolioImportResponse(int Inserted);

public sealed record PortfolioMutationRequest(
    string Name,
    string? Broker,
    string? Notes)
{
    public PortfolioMutation ToMutation() => new(Name, Broker, Notes);
}

public sealed record TransactionMutationRequest(
    string Action,
    [property: JsonPropertyName("transaction_currency")] string TransactionCurrency,
    decimal Shares,
    decimal Price,
    [property: JsonPropertyName("transaction_date")] DateOnly TransactionDate,
    string? Notes,
    [property: JsonPropertyName("portfolio_id")] Guid? PortfolioId,
    [property: JsonPropertyName("security_listing_id")] Guid SecurityListingId,
    [property: JsonPropertyName("use_available_cash")] bool UseAvailableCash = false,
    [property: JsonPropertyName("fee_amount")] decimal FeeAmount = 0m)
{
    public TransactionMutation ToMutation() =>
        new(Action, TransactionCurrency, Shares, Price, TransactionDate,
            Notes, PortfolioId, SecurityListingId, UseAvailableCash, FeeAmount);
}

public sealed record CashWithdrawalRequest(
    [property: JsonPropertyName("portfolio_id")] Guid? PortfolioId,
    string Currency,
    decimal Amount,
    [property: JsonPropertyName("withdrawal_date")] DateOnly WithdrawalDate,
    string? Notes);

public sealed record TransactionBulkDeleteRequest(IReadOnlyList<Guid> Ids);

public sealed record TransactionImportRequest(
    IReadOnlyList<ImportedTransactionRequest?> Rows,
    string? ImportedPortfolioNotes)
{
    public TransactionImportMutation ToMutation() =>
        new(
            Rows.Select(row => row!.ToMutation()).ToArray(),
            ImportedPortfolioNotes);
}

public sealed record ImportedTransactionRequest(
    string Ticker,
    string? Name,
    [property: JsonPropertyName("asset_type")] string AssetType,
    string Currency,
    decimal Shares,
    decimal Price,
    [property: JsonPropertyName("transaction_date")] DateOnly TransactionDate,
    string? Notes,
    [property: JsonPropertyName("portfolio_name")] string PortfolioName,
    [property: JsonPropertyName("security_listing_id")] Guid? SecurityListingId = null)
{
    public ImportedTransactionMutation ToMutation() =>
        new(Ticker, Name, AssetType, Currency, Shares, Price,
            TransactionDate, Notes, PortfolioName, SecurityListingId);
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
    string Action,
    [property: JsonPropertyName("transaction_currency")] string TransactionCurrency,
    decimal Shares,
    decimal Price,
    [property: JsonPropertyName("transaction_date")] DateOnly TransactionDate,
    string? Notes,
    [property: JsonPropertyName("portfolio_id")] Guid? PortfolioId,
    [property: JsonPropertyName("security_listing_id")] Guid SecurityListingId,
    SecurityMetadataView Security,
    [property: JsonPropertyName("cash_used")] decimal CashUsed,
    [property: JsonPropertyName("fee_amount")] decimal FeeAmount,
    [property: JsonPropertyName("settles_to_cash")] bool SettlesToCash,
    [property: JsonPropertyName("created_at")] DateTimeOffset? CreatedAt = null)
{
    public static TransactionResponse From(TransactionListItem transaction) =>
        new(
            transaction.Id,
            transaction.Action,
            transaction.TransactionCurrency,
            transaction.Shares,
            transaction.Price,
            transaction.TransactionDate,
            transaction.Notes,
            transaction.PortfolioId,
            transaction.SecurityListingId,
            transaction.Security ?? throw new InvalidOperationException(
                "Transaction security metadata is required."),
            transaction.CashUsed,
            transaction.FeeAmount,
            transaction.SettlesToCash,
            transaction.CreatedAt);
}
