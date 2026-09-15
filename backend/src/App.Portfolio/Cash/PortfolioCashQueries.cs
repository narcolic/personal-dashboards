using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.Cash;

public sealed class PortfolioCashQueries(AppDataSource dataSource) : IPortfolioCashQueries
{
    public Task<IReadOnlyList<PortfolioCashBalance>> ListAsync(
        Guid userId,
        DateOnly? asOf = null,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserReadOnlyAsync(
            userId,
            (connection, transaction, token) => ReadAsync(
                connection,
                transaction,
                userId,
                asOf ?? DateOnly.FromDateTime(DateTime.UtcNow),
                token),
            cancellationToken);

    private static async Task<IReadOnlyList<PortfolioCashBalance>> ReadAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        DateOnly asOf,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select portfolio_id, currency,
                   sum(amount)::numeric as available_amount,
                   sum(external_flow)::numeric as external_flow
            from (
              select t.portfolio_id,
                     upper(t.transaction_currency) as currency,
                     case
                       when t.action = 'sell' and t.settles_to_cash
                         then (t.shares * t.price) - t.fee_amount
                       when t.action = 'buy' then -t.cash_used
                       else 0
                     end::numeric as amount,
                     case when t.transaction_date = $2 and t.action = 'buy'
                       then (t.shares * t.price) + t.fee_amount - t.cash_used
                       else 0 end::numeric as external_flow
              from public.transactions t
              where t.user_id = $1 and t.transaction_date <= $2
              union all
              select w.portfolio_id, upper(w.currency), -w.amount::numeric,
                     case when w.withdrawal_date = $2 then -w.amount else 0 end::numeric
              from public.portfolio_cash_withdrawals w
              where w.user_id = $1 and w.withdrawal_date <= $2
            ) events
            group by portfolio_id, currency
            having sum(amount) <> 0 or sum(external_flow) <> 0
            order by currency, portfolio_id;
            """;
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Uuid, Value = userId });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Date, Value = asOf });
        var rows = new List<PortfolioCashBalance>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            rows.Add(new(
                reader.IsDBNull(0) ? null : reader.GetGuid(0),
                reader.GetString(1),
                reader.GetDecimal(2),
                reader.GetDecimal(3)));
        }
        return rows;
    }
}
