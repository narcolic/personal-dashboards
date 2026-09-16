using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio.SecurityMetadata;

namespace PortfolioTerminal.Portfolio.Activity;

public sealed class ActivityQueries(AppDataSource dataSource,
    ISecurityMetadataQueries metadataQueries) : IActivityQueries
{
    public static readonly IReadOnlyDictionary<string, string> SortColumns =
        new Dictionary<string, string>
        {
            ["transaction_date"] = "event_date", ["ticker"] = "symbol",
            ["portfolio"] = "portfolio_name", ["action"] = "action",
            ["asset_type"] = "asset_type", ["shares"] = "shares",
            ["price"] = "price", ["total"] = "amount",
        };

    public async Task<ActivityListResult> ListAsync(Guid userId, ActivityListFilter filter,
        CancellationToken cancellationToken = default)
    {
        var result = await dataSource.ExecuteAsUserReadOnlyAsync(userId,
            (connection, transaction, token) => ReadAsync(connection, transaction, userId, filter, token),
            cancellationToken).ConfigureAwait(false);
        var ids = result.Rows.Where(row => row.SecurityListingId.HasValue)
            .Select(row => row.SecurityListingId!.Value).Distinct().ToArray();
        var metadata = await metadataQueries.GetByListingIdsAsync(userId, ids, cancellationToken)
            .ConfigureAwait(false);
        return result with { Rows = result.Rows.Select(row => row.Kind == "withdrawal" ? row
            : metadata.TryGetValue(row.SecurityListingId!.Value, out var security)
                ? row with { Security = security }
                : throw new InvalidOperationException($"Canonical security metadata is missing for transaction {row.Id}."))
            .ToArray() };
    }

    private static async Task<ActivityListResult> ReadAsync(NpgsqlConnection connection,
        NpgsqlTransaction transaction, Guid userId, ActivityListFilter filter, CancellationToken token)
    {
        var f = filter.Transactions;
        var conditions = new List<string> { "user_id = @userId" };
        if (!string.IsNullOrWhiteSpace(f.Ticker)) conditions.Add("symbol ilike @ticker");
        if (f.UnassignedPortfolio) conditions.Add("portfolio_id is null");
        else if (f.PortfolioId.HasValue) conditions.Add("portfolio_id = @portfolioId");
        if (!string.IsNullOrWhiteSpace(f.AssetType)) conditions.Add("asset_type = @assetType");
        if (!string.IsNullOrWhiteSpace(f.Currency)) conditions.Add("currency = @currency");
        if (f.DateFrom.HasValue) conditions.Add("event_date >= @dateFrom");
        if (f.DateTo.HasValue) conditions.Add("event_date <= @dateTo");
        var cte = """
            with events as (
              select 'transaction'::text as kind, t.id, t.user_id, t.action,
                     t.transaction_currency as currency, t.shares::numeric, t.price::numeric,
                     t.transaction_date as event_date, t.notes, t.portfolio_id, t.security_listing_id,
                     (t.shares * t.price)::numeric as amount, t.cash_used::numeric,
                     t.fee_amount::numeric, t.settles_to_cash,
                     listing.symbol, security.security_type_code as asset_type, p.name as portfolio_name
              from public.transactions t
              join public.security_listings listing on listing.id = t.security_listing_id
              join public.securities security on security.id = listing.security_id
              left join public.portfolios p on p.id = t.portfolio_id and p.user_id = @userId
              where t.user_id = @userId
              union all
              select 'withdrawal', w.id, w.user_id, 'withdrawal', w.currency,
                     null::numeric, null::numeric, w.withdrawal_date, w.notes, w.portfolio_id,
                     null::uuid, w.amount::numeric, 0::numeric, 0::numeric, false,
                     null::text, null::text, p.name
              from public.portfolio_cash_withdrawals w
              left join public.portfolios p on p.id = w.portfolio_id and p.user_id = @userId
              where w.user_id = @userId
            ), filtered as (select * from events where
            """ + " " + string.Join(" and ", conditions) + ")";
        // Only identifiers from this allowlist enter SQL; all filter values are parameters.
        var sort = SortColumns[filter.Sort];
        var direction = filter.Direction == "asc" ? "asc" : "desc";
        await using var batch = new NpgsqlBatch(connection, transaction);
        foreach (var sql in new[]
        {
            cte + " select count(*)::bigint from filtered;",
            cte + $" select kind, id, action, currency, shares, price, event_date, notes, portfolio_id, security_listing_id, amount, cash_used, fee_amount, settles_to_cash from filtered order by {sort} {direction} nulls last, kind, id" +
                (f.Limit.HasValue ? " limit @limit offset @offset;" : ";"),
        })
        {
            var command = new NpgsqlBatchCommand(sql);
            command.Parameters.AddWithValue("userId", userId);
            if (!string.IsNullOrWhiteSpace(f.Ticker)) command.Parameters.AddWithValue("ticker", $"%{f.Ticker.Trim()}%");
            if (!f.UnassignedPortfolio && f.PortfolioId.HasValue) command.Parameters.AddWithValue("portfolioId", f.PortfolioId.Value);
            if (!string.IsNullOrWhiteSpace(f.AssetType)) command.Parameters.AddWithValue("assetType", f.AssetType);
            if (!string.IsNullOrWhiteSpace(f.Currency)) command.Parameters.AddWithValue("currency", f.Currency.ToUpperInvariant());
            if (f.DateFrom.HasValue) command.Parameters.AddWithValue("dateFrom", NpgsqlDbType.Date, f.DateFrom.Value);
            if (f.DateTo.HasValue) command.Parameters.AddWithValue("dateTo", NpgsqlDbType.Date, f.DateTo.Value);
            if (f.Limit.HasValue && sql.Contains("@limit"))
            {
                command.Parameters.AddWithValue("limit", f.Limit.Value);
                command.Parameters.AddWithValue("offset", f.Offset ?? 0);
            }
            batch.BatchCommands.Add(command);
        }
        await using var reader = await batch.ExecuteReaderAsync(token).ConfigureAwait(false);
        await reader.ReadAsync(token).ConfigureAwait(false);
        var count = reader.GetInt64(0);
        await reader.NextResultAsync(token).ConfigureAwait(false);
        var rows = new List<ActivityListItem>();
        while (await reader.ReadAsync(token).ConfigureAwait(false))
            rows.Add(new ActivityListItem(reader.GetString(0), reader.GetGuid(1), reader.GetString(2),
                reader.GetString(3), reader.IsDBNull(4) ? null : reader.GetDecimal(4),
                reader.IsDBNull(5) ? null : reader.GetDecimal(5), reader.GetFieldValue<DateOnly>(6),
                reader.IsDBNull(7) ? null : reader.GetString(7), reader.IsDBNull(8) ? null : reader.GetGuid(8),
                reader.IsDBNull(9) ? null : reader.GetGuid(9), reader.GetDecimal(10),
                reader.GetDecimal(11), reader.GetDecimal(12), reader.GetBoolean(13)));
        return new ActivityListResult(rows, count);
    }
}
