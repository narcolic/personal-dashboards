using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio.Cash;

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

    public async Task<PortfolioMutationResult> DeleteAsync(
        Guid userId,
        Guid portfolioId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await dataSource.ExecuteAsUserAsync(
                userId,
                async (connection, transaction, token) =>
                {
                    // Serialize with transaction writes and lock the owned portfolio
                    // before checking its activity. The FK protects other writers.
                    await PortfolioAccountingGuard.LockUserAsync(connection, transaction, userId, token)
                        .ConfigureAwait(false);
                    await using var command = connection.CreateCommand();
                    command.Transaction = transaction;
                    command.CommandText = "select id from public.portfolios where id = $1 and user_id = $2 for update;";
                    AddUuid(command, portfolioId);
                    AddUuid(command, userId);
                    if (await command.ExecuteScalarAsync(token).ConfigureAwait(false) is not Guid)
                        return PortfolioMutationResult.Missing("Portfolio not found.");

                    command.CommandText = """
                        select exists(select 1 from public.transactions
                          where portfolio_id = $1 and user_id = $2);
                        """;
                    if ((bool)(await command.ExecuteScalarAsync(token).ConfigureAwait(false))!)
                        return PortfolioMutationResult.Conflicted(TransactionsMustBeDeleted);

                    command.CommandText = """
                        delete from public.portfolios
                        where id = $1 and user_id = $2
                        returning id;
                        """;
                    return await command.ExecuteScalarAsync(token).ConfigureAwait(false) is Guid
                        ? PortfolioMutationResult.Succeeded()
                        : PortfolioMutationResult.Missing("Portfolio not found.");
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (PostgresException exception) when (
            exception.SqlState == PostgresErrorCodes.ForeignKeyViolation &&
            exception.ConstraintName is "transactions_portfolio_id_fkey" or "positions_portfolio_id_fkey")
        {
            return PortfolioMutationResult.Conflicted(TransactionsMustBeDeleted);
        }
    }

    private const string TransactionsMustBeDeleted =
        "Delete all transactions in this portfolio before deleting it.";

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
