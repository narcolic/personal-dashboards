using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.Portfolios;

public sealed class PortfolioCommands(AppDataSource dataSource) : IPortfolioCommands
{
    public Task<PortfolioMutationResult> CreateAsync(
        Guid userId,
        PortfolioMutation mutation,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = """
                    insert into public.portfolios (user_id, name, broker, notes)
                    values ($1, $2, $3, $4)
                    returning id;
                    """;
                AddUuid(command, userId);
                command.Parameters.AddWithValue(mutation.Name.Trim());
                AddNullableText(command, mutation.Broker);
                AddNullableText(command, mutation.Notes);
                var id = (Guid)(await command.ExecuteScalarAsync(token).ConfigureAwait(false))!;
                return PortfolioMutationResult.Succeeded(id);
            },
            cancellationToken);

    public Task<PortfolioMutationResult> DeleteAsync(
        Guid userId,
        Guid portfolioId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = """
                    delete from public.portfolios
                    where id = $1 and user_id = $2
                    returning id;
                    """;
                AddUuid(command, portfolioId);
                AddUuid(command, userId);
                return await command.ExecuteScalarAsync(token).ConfigureAwait(false) is Guid
                    ? PortfolioMutationResult.Succeeded()
                    : PortfolioMutationResult.Missing("Portfolio not found.");
            },
            cancellationToken);

    private static void AddNullableText(NpgsqlCommand command, string? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Text,
            Value = string.IsNullOrWhiteSpace(value) ? DBNull.Value : value.Trim(),
        });

    private static void AddUuid(NpgsqlCommand command, Guid value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = value,
        });
}
