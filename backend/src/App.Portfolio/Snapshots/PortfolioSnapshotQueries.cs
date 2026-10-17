using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.Snapshots;

public sealed class PortfolioSnapshotQueries(AppDataSource dataSource) : IPortfolioSnapshotQueries
{
    public Task<IReadOnlyList<PortfolioSnapshotListItem>> ListAsync(
        Guid userId,
        int limit,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserReadOnlyAsync(
            userId,
            (connection, transaction, token) =>
                ReadAsync(connection, transaction, userId, limit, token),
            cancellationToken);

    public Task<IReadOnlyList<PortfolioSnapshotListItem>> SearchAsync(
        Guid userId,
        string scopeKey,
        DateOnly dateFrom,
        DateOnly dateTo,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserReadOnlyAsync(
            userId,
            (connection, transaction, token) =>
                ReadRangeAsync(connection, transaction, userId, scopeKey, dateFrom, dateTo, token),
            cancellationToken);

    private static async Task<IReadOnlyList<PortfolioSnapshotListItem>> ReadAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        int limit,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id, user_id, snapshot_date, snapshot_at, scope, scope_key,
                   portfolio_id, portfolio_name,
                   market_value_eur::numeric, market_value_usd::numeric,
                   cost_basis_eur::numeric, cost_basis_usd::numeric,
                   unrealized_eur::numeric, unrealized_usd::numeric,
                   quote_metadata::text, fx_metadata::text,
                   created_at, updated_at,
                   cash_balance_eur::numeric, cash_balance_usd::numeric,
                   total_value_eur::numeric, total_value_usd::numeric,
                   realized_eur::numeric, realized_usd::numeric,
                   total_pnl_eur::numeric, total_pnl_usd::numeric,
                   external_flow_eur::numeric, external_flow_usd::numeric,
                   accounting_version
            from public.portfolio_value_snapshots
            where user_id = $1
            order by snapshot_date desc, scope, id
            limit $2;
            """;
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = userId,
        });
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Integer,
            Value = limit,
        });

        var items = new List<PortfolioSnapshotListItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            items.Add(new PortfolioSnapshotListItem(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetFieldValue<DateOnly>(2),
                reader.GetFieldValue<DateTimeOffset>(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetGuid(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.GetDecimal(8),
                reader.GetDecimal(9),
                reader.GetDecimal(10),
                reader.GetDecimal(11),
                reader.GetDecimal(12),
                reader.GetDecimal(13),
                JsonDocument.Parse(reader.GetString(14)).RootElement.Clone(),
                JsonDocument.Parse(reader.GetString(15)).RootElement.Clone(),
                reader.GetFieldValue<DateTimeOffset>(16),
                reader.GetFieldValue<DateTimeOffset>(17),
                reader.GetDecimal(18), reader.GetDecimal(19),
                reader.GetDecimal(20), reader.GetDecimal(21),
                reader.GetDecimal(22), reader.GetDecimal(23),
                reader.GetDecimal(24), reader.GetDecimal(25),
                reader.GetDecimal(26), reader.GetDecimal(27),
                reader.GetInt16(28)));
        }

        await reader.CloseAsync().ConfigureAwait(false);
        var adjusted = await AdjustSnapshotsAsync(connection, transaction, userId, items, cancellationToken).ConfigureAwait(false);
        return adjusted.OrderByDescending(row => row.SnapshotDate).ThenBy(row => row.Scope)
            .ThenBy(row => row.Id).ToArray();
    }

    private static async Task<IReadOnlyList<PortfolioSnapshotListItem>> ReadRangeAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        string scopeKey,
        DateOnly dateFrom,
        DateOnly dateTo,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id, user_id, snapshot_date, snapshot_at, scope, scope_key,
                   portfolio_id, portfolio_name,
                   market_value_eur::numeric, market_value_usd::numeric,
                   cost_basis_eur::numeric, cost_basis_usd::numeric,
                   unrealized_eur::numeric, unrealized_usd::numeric,
                   quote_metadata::text, fx_metadata::text,
                   created_at, updated_at,
                   cash_balance_eur::numeric, cash_balance_usd::numeric,
                   total_value_eur::numeric, total_value_usd::numeric,
                   realized_eur::numeric, realized_usd::numeric,
                   total_pnl_eur::numeric, total_pnl_usd::numeric,
                   external_flow_eur::numeric, external_flow_usd::numeric,
                   accounting_version
            from public.portfolio_value_snapshots
            where user_id = $1
              and scope_key = $2
              and snapshot_date between $3 and $4
            order by snapshot_date, id
            limit 2000;
            """;
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Uuid, Value = userId });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = scopeKey });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Date, Value = dateFrom });
        // A midnight capture belongs to the previous valuation day.
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Date,
            Value = dateTo == DateOnly.MaxValue ? dateTo : dateTo.AddDays(1) });

        var items = new List<PortfolioSnapshotListItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            items.Add(ReadItem(reader));
        }
        await reader.CloseAsync().ConfigureAwait(false);
        var adjusted = await AdjustSnapshotsAsync(connection, transaction, userId, items, cancellationToken).ConfigureAwait(false);
        return adjusted.Where(row => row.SnapshotDate >= dateFrom && row.SnapshotDate <= dateTo)
            .OrderBy(row => row.SnapshotDate).ThenBy(row => row.Id).ToArray();
    }

    private static async Task<IReadOnlyList<PortfolioSnapshotListItem>> AdjustSnapshotsAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, Guid userId,
        IReadOnlyList<PortfolioSnapshotListItem> items, CancellationToken cancellationToken)
    {
        var legacy = items.Where(row => row.AccountingVersion is 2 or 3 || NeedsFlowCorrection(row)).ToArray();
        if (legacy.Length == 0) return items.Select(WithValuationDate).ToArray();
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id, security_listing_id, portfolio_id, upper(transaction_currency), action,
                   shares::numeric, price::numeric, fee_amount::numeric, cash_used::numeric,
                   settles_to_cash, transaction_date, created_at
            from public.transactions
            where user_id = $1 and transaction_date <= $2 and action in ('buy', 'sell')
            order by transaction_date, created_at, id;
            """;
        command.Parameters.AddWithValue(userId);
        command.Parameters.AddWithValue(legacy.Max(row => row.SnapshotDate));
        var history = new List<SnapshotTransaction>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
            history.Add(new SnapshotTransaction(
                reader.GetGuid(0), userId, reader.GetGuid(1), "", reader.GetString(3),
                reader.GetDecimal(5), reader.GetDecimal(6), reader.GetFieldValue<DateOnly>(10),
                reader.IsDBNull(2) ? null : reader.GetGuid(2), null, reader.GetString(4),
                reader.GetDecimal(8), reader.GetDecimal(7), reader.GetBoolean(9),
                reader.IsDBNull(11) ? null : reader.GetFieldValue<DateTimeOffset>(11)));
        await reader.CloseAsync().ConfigureAwait(false);
        var withdrawals = new List<SnapshotWithdrawal>();
        if (legacy.Length > 0)
        {
            await using var withdrawalCommand = connection.CreateCommand();
            withdrawalCommand.Transaction = transaction;
            withdrawalCommand.CommandText = """
                select id, portfolio_id, currency, amount::numeric, withdrawal_date
                from public.portfolio_cash_withdrawals
                where user_id = $1 and withdrawal_date <= $2;
                """;
            withdrawalCommand.Parameters.AddWithValue(userId);
            withdrawalCommand.Parameters.AddWithValue(items.Max(row => ValuationDate(row)));
            await using var withdrawalReader = await withdrawalCommand.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
            while (await withdrawalReader.ReadAsync(cancellationToken).ConfigureAwait(false))
                withdrawals.Add(new SnapshotWithdrawal(withdrawalReader.GetGuid(0), userId,
                    withdrawalReader.IsDBNull(1) ? null : withdrawalReader.GetGuid(1), null,
                    withdrawalReader.GetString(2), withdrawalReader.GetDecimal(3),
                    withdrawalReader.GetFieldValue<DateOnly>(4)));
        }
        return items.Select(row =>
        {
            var adjusted = PortfolioSnapshotFeeAdjustment.Apply(row, history);
            if (NeedsFlowCorrection(row))
                adjusted = CorrectExternalFlow(adjusted, history, withdrawals);
            adjusted = PortfolioSnapshotCashReconciliation.Apply(adjusted, history, withdrawals);
            return WithValuationDate(adjusted);
        }).ToArray();
    }

    private static DateOnly ValuationDate(PortfolioSnapshotListItem row) =>
        PortfolioSnapshotDates.ValuationDate(row.SnapshotDate, row.SnapshotAt, row.QuoteMetadata);

    private static PortfolioSnapshotListItem WithValuationDate(PortfolioSnapshotListItem row) =>
        row with { SnapshotDate = ValuationDate(row) };

    private static bool NeedsFlowCorrection(PortfolioSnapshotListItem row) =>
        row.AccountingVersion >= 2 && ValuationDate(row) != row.SnapshotDate &&
        !(row.QuoteMetadata.ValueKind == JsonValueKind.Object &&
          row.QuoteMetadata.TryGetProperty("valuationDate", out _));

    private static PortfolioSnapshotListItem CorrectExternalFlow(
        PortfolioSnapshotListItem snapshot, IReadOnlyList<SnapshotTransaction> history,
        IReadOnlyList<SnapshotWithdrawal> withdrawals)
    {
        var date = ValuationDate(snapshot);
        bool Matches(Guid user, Guid? portfolio) => user == snapshot.UserId &&
            (snapshot.Scope == "total" || portfolio == snapshot.PortfolioId);
        decimal Convert(decimal amount, string currency, string target)
        {
            if (amount == 0m || currency == target) return amount;
            decimal Rate(string code) => code == "USD" ? 1m :
                snapshot.FxMetadata.GetProperty("rates").GetProperty(code).GetDecimal();
            return amount / Rate(currency) * Rate(target);
        }
        decimal Flow(string currency) => history
            .Where(row => row.TransactionDate == date && row.Action == "buy" && Matches(row.UserId, row.PortfolioId))
            .Sum(row => Convert(Math.Max(0m, row.Shares * row.Price - row.CashUsed),
                (row.Currency ?? "USD").ToUpperInvariant(), currency)) -
            withdrawals.Where(row => row.WithdrawalDate == date && Matches(row.UserId, row.PortfolioId))
                .Sum(row => Convert(Cash.PortfolioCashCalculator.CashAmount(row.Amount), row.Currency.ToUpperInvariant(), currency));
        return snapshot with { ExternalFlowEur = Flow("EUR"), ExternalFlowUsd = Flow("USD") };
    }

    private static PortfolioSnapshotListItem ReadItem(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetGuid(1),
        reader.GetFieldValue<DateOnly>(2),
        reader.GetFieldValue<DateTimeOffset>(3),
        reader.GetString(4),
        reader.GetString(5),
        reader.IsDBNull(6) ? null : reader.GetGuid(6),
        reader.IsDBNull(7) ? null : reader.GetString(7),
        reader.GetDecimal(8),
        reader.GetDecimal(9),
        reader.GetDecimal(10),
        reader.GetDecimal(11),
        reader.GetDecimal(12),
        reader.GetDecimal(13),
        JsonDocument.Parse(reader.GetString(14)).RootElement.Clone(),
        JsonDocument.Parse(reader.GetString(15)).RootElement.Clone(),
        reader.GetFieldValue<DateTimeOffset>(16),
        reader.GetFieldValue<DateTimeOffset>(17),
        reader.GetDecimal(18), reader.GetDecimal(19),
        reader.GetDecimal(20), reader.GetDecimal(21),
        reader.GetDecimal(22), reader.GetDecimal(23),
        reader.GetDecimal(24), reader.GetDecimal(25),
        reader.GetDecimal(26), reader.GetDecimal(27),
        reader.GetInt16(28));
}
