using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.Portfolios;

public sealed class PortfolioQueries(AppDataSource dataSource) : IPortfolioQueries
{
    public Task<IReadOnlyList<PortfolioListItem>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            (connection, transaction, token) =>
                ReadPortfoliosAsync(connection, transaction, userId, token),
            cancellationToken);

    private static async Task<IReadOnlyList<PortfolioListItem>> ReadPortfoliosAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id, name, broker, notes
            from public.portfolios
            where user_id = $1
            order by name, id;
            """;
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = userId,
        });

        var portfolios = new List<PortfolioListItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);

        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            portfolios.Add(new PortfolioListItem(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3)));
        }

        return portfolios;
    }
}
