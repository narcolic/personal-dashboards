using System.ComponentModel;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ModelContextProtocol;
using ModelContextProtocol.Server;
using PortfolioTerminal.Api.Auth;
using PortfolioTerminal.Portfolio.Analytics;
using PortfolioTerminal.Portfolio.Portfolios;

namespace PortfolioTerminal.Api.Mcp;

public sealed partial class PortfolioMcpTools
{
    [McpServerTool(
        Name = "portfolio_list",
        Title = "List portfolios",
        ReadOnly = true,
        Destructive = false,
        Idempotent = true,
        OpenWorld = false,
        UseStructuredContent = true)]
    [Description("Lists the authenticated user's Portfolio Terminal portfolios and stable selectors. Use this before a named portfolio is ambiguous.")]
    [McpMeta("securitySchemes", JsonValue = """[{"type":"oauth2","scopes":["openid"]}]""")]
    public static Task<PortfolioListToolResult> ListAsync(
        IPortfolioQueries queries,
        ICurrentUser currentUser,
        TimeProvider timeProvider,
        ILogger<PortfolioMcpTools> logger,
        CancellationToken cancellationToken) =>
        ExecuteAsync("portfolio_list", currentUser, logger, async () =>
        {
            var portfolios = await queries.ListAsync(currentUser.UserId, cancellationToken).ConfigureAwait(false);
            return new PortfolioListToolResult(
                timeProvider.GetUtcNow(),
                "all",
                "all",
                true,
                [.. portfolios.Select(item => new PortfolioListToolItem(
                    $"portfolio:{item.Id}",
                    item.Name,
                    item.Broker,
                    item.Notes))],
                []);
        });

    [McpServerTool(
        Name = "portfolio_get_summary",
        Title = "Get portfolio summary",
        ReadOnly = true,
        Destructive = false,
        Idempotent = true,
        OpenWorld = false,
        UseStructuredContent = true)]
    [Description("Returns live value, cost basis, unrealized P&L, day change, and ranked positions. It does not calculate realized profit or cash-flow-adjusted returns.")]
    [McpMeta("securitySchemes", JsonValue = """[{"type":"oauth2","scopes":["openid"]}]""")]
    public static Task<PortfolioSummaryResult> GetSummaryAsync(
        IPortfolioAnalysisService analysis,
        ICurrentUser currentUser,
        ILogger<PortfolioMcpTools> logger,
        [Description("Portfolio selector: all, unassigned, portfolio:<id>, or a unique portfolio name.")] string portfolio = "all",
        [Description("Display currency: EUR or USD.")] string displayCurrency = "EUR",
        [Description("Number of ranked positions to return, from 1 to 10.")] int top = 5,
        CancellationToken cancellationToken = default) =>
        ExecuteAsync("portfolio_get_summary", currentUser, logger, () =>
            analysis.GetSummaryAsync(currentUser.UserId, portfolio, displayCurrency, top, cancellationToken));

    [McpServerTool(
        Name = "portfolio_get_holdings",
        Title = "Get portfolio holdings",
        ReadOnly = true,
        Destructive = false,
        Idempotent = true,
        OpenWorld = false,
        UseStructuredContent = true)]
    [Description("Lists live holdings and portfolio weights, optionally filtered by ticker. Results use the application's current buy-only cost-basis semantics.")]
    [McpMeta("securitySchemes", JsonValue = """[{"type":"oauth2","scopes":["openid"]}]""")]
    public static Task<PortfolioHoldingsResult> GetHoldingsAsync(
        IPortfolioAnalysisService analysis,
        ICurrentUser currentUser,
        ILogger<PortfolioMcpTools> logger,
        [Description("Portfolio selector: all, unassigned, portfolio:<id>, or a unique name.")] string portfolio = "all",
        [Description("Optional ticker symbols, maximum 20.")] string[]? tickers = null,
        [Description("Display currency: EUR or USD.")] string displayCurrency = "EUR",
        [Description("Sort: weight, value, unrealizedPnl, returnPct, or ticker.")] string sort = "weight",
        [Description("Maximum rows from 1 to 50.")] int limit = 20,
        CancellationToken cancellationToken = default) =>
        ExecuteAsync("portfolio_get_holdings", currentUser, logger, () =>
            analysis.GetHoldingsAsync(currentUser.UserId, portfolio, tickers, displayCurrency, sort, limit, cancellationToken));

    [McpServerTool(
        Name = "portfolio_get_history",
        Title = "Get portfolio value history",
        ReadOnly = true,
        Destructive = false,
        Idempotent = true,
        OpenWorld = false,
        UseStructuredContent = true)]
    [Description("Returns bounded stored portfolio-value history. Value change is explicitly not a cash-flow-adjusted investment return.")]
    [McpMeta("securitySchemes", JsonValue = """[{"type":"oauth2","scopes":["openid"]}]""")]
    public static Task<PortfolioHistoryResult> GetHistoryAsync(
        IPortfolioAnalysisService analysis,
        ICurrentUser currentUser,
        ILogger<PortfolioMcpTools> logger,
        [Description("Portfolio selector: all, unassigned, portfolio:<id>, or a unique name.")] string portfolio = "all",
        [Description("Optional inclusive start date in YYYY-MM-DD format.")] DateOnly? dateFrom = null,
        [Description("Optional inclusive end date in YYYY-MM-DD format.")] DateOnly? dateTo = null,
        [Description("Display currency: EUR or USD.")] string displayCurrency = "EUR",
        [Description("Interval: daily, weekly, or monthly.")] string interval = "daily",
        [Description("Maximum points from 2 to 120.")] int maxPoints = 60,
        CancellationToken cancellationToken = default) =>
        ExecuteAsync("portfolio_get_history", currentUser, logger, () =>
            analysis.GetHistoryAsync(currentUser.UserId, portfolio, dateFrom, dateTo, displayCurrency, interval, maxPoints, cancellationToken));

    [McpServerTool(
        Name = "portfolio_get_allocation",
        Title = "Get portfolio allocation",
        ReadOnly = true,
        Destructive = false,
        Idempotent = true,
        OpenWorld = false,
        UseStructuredContent = true)]
    [Description("Returns allocation by securityType, currency, portfolio, country, region, sector, or industry. Unknown persisted classifications are returned as Unknown.")]
    [McpMeta("securitySchemes", JsonValue = """[{"type":"oauth2","scopes":["openid"]}]""")]
    public static Task<PortfolioAllocationResult> GetAllocationAsync(
        IPortfolioAnalysisService analysis,
        ICurrentUser currentUser,
        ILogger<PortfolioMcpTools> logger,
        [Description("Portfolio selector: all, unassigned, portfolio:<id>, or a unique name.")] string portfolio = "all",
        [Description("Allocation dimension: securityType, currency, portfolio, country, region, sector, or industry.")] string dimension = "securityType",
        [Description("Display currency: EUR or USD.")] string displayCurrency = "EUR",
        [Description("Maximum allocation groups from 1 to 20.")] int limit = 10,
        CancellationToken cancellationToken = default) =>
        ExecuteAsync("portfolio_get_allocation", currentUser, logger, () =>
            analysis.GetAllocationAsync(currentUser.UserId, portfolio, dimension, displayCurrency, limit, cancellationToken));

    [McpServerTool(
        Name = "portfolio_simulate_purchase",
        Title = "Simulate a portfolio purchase",
        ReadOnly = true,
        Destructive = false,
        Idempotent = true,
        OpenWorld = false,
        UseStructuredContent = true)]
    [Description("Simulates the concentration and allocation effect of a hypothetical purchase. It never creates a transaction or changes portfolio data.")]
    [McpMeta("securitySchemes", JsonValue = """[{"type":"oauth2","scopes":["openid"]}]""")]
    public static Task<PortfolioSimulationResult> SimulatePurchaseAsync(
        IPortfolioAnalysisService analysis,
        ICurrentUser currentUser,
        ILogger<PortfolioMcpTools> logger,
        [Description("Ticker symbol to simulate.")] string ticker,
        [Description("Positive investment amount, no more than 100,000,000.")] decimal amount,
        [Description("Investment currency: EUR or USD.")] string amountCurrency,
        [Description("Portfolio selector: all, unassigned, portfolio:<id>, or a unique name.")] string portfolio = "all",
        [Description("Display currency: EUR or USD.")] string displayCurrency = "EUR",
        CancellationToken cancellationToken = default) =>
        ExecuteAsync("portfolio_simulate_purchase", currentUser, logger, () =>
            analysis.SimulatePurchaseAsync(currentUser.UserId, portfolio, ticker, amount, amountCurrency, displayCurrency, cancellationToken));

    private static async Task<T> ExecuteAsync<T>(
        string tool,
        ICurrentUser currentUser,
        ILogger logger,
        Func<Task<T>> operation)
    {
        var stopwatch = Stopwatch.StartNew();
        var subject = HashSubject(currentUser.UserId);
        var clientId = currentUser.ClientId ?? "none";
        var traceId = Activity.Current?.TraceId.ToString() ?? "none";
        try
        {
            var result = await operation().ConfigureAwait(false);
            ToolCompleted(logger, tool, subject, clientId, traceId, stopwatch.ElapsedMilliseconds);
            return result;
        }
        catch (PortfolioAnalysisException exception)
        {
            ToolFailed(logger, tool, subject, clientId, traceId, exception.Code, stopwatch.ElapsedMilliseconds);
            throw new McpException(JsonSerializer.Serialize(new
            {
                code = exception.Code,
                message = exception.Message,
            }));
        }
    }

    private static string HashSubject(Guid userId)
    {
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(userId.ToString("D")));
        return Convert.ToHexString(digest.AsSpan(0, 8));
    }

    [LoggerMessage(
        EventId = 4100,
        Level = LogLevel.Information,
        Message = "MCP tool {Tool} completed for user {UserHash}, client {ClientId}, trace {TraceId} in {DurationMs}ms")]
    private static partial void ToolCompleted(
        ILogger logger,
        string tool,
        string userHash,
        string clientId,
        string traceId,
        long durationMs);

    [LoggerMessage(
        EventId = 4101,
        Level = LogLevel.Warning,
        Message = "MCP tool {Tool} failed for user {UserHash}, client {ClientId}, trace {TraceId} with {ErrorCode} in {DurationMs}ms")]
    private static partial void ToolFailed(
        ILogger logger,
        string tool,
        string userHash,
        string clientId,
        string traceId,
        string errorCode,
        long durationMs);
}

public sealed record PortfolioListToolItem(
    string PortfolioRef,
    string Name,
    string? Broker,
    string? Notes);

public sealed record PortfolioListToolResult(
    DateTimeOffset AsOf,
    string Scope,
    string DefaultScope,
    bool SupportsUnassigned,
    IReadOnlyList<PortfolioListToolItem> Portfolios,
    IReadOnlyList<PortfolioAnalysisWarning> Warnings);
