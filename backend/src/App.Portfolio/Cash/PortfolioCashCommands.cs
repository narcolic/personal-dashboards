using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.Cash;

public sealed class PortfolioCashCommands(AppDataSource dataSource) : IPortfolioCashCommands
{
    public async Task<PortfolioMutationResult> WithdrawAsync(
        Guid userId,
        CashWithdrawalMutation mutation,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await dataSource.ExecuteAsUserAsync(
                userId,
                async (connection, transaction, token) =>
                {
                    await PortfolioAccountingGuard.LockUserAsync(connection, transaction, userId, token)
                        .ConfigureAwait(false);
                    if (!await OwnsPortfolioAsync(connection, transaction, userId, mutation.PortfolioId, token)
                            .ConfigureAwait(false))
                    {
                        return PortfolioMutationResult.Missing("Portfolio not found.");
                    }

                    var available = await PortfolioAccountingGuard.GetAvailableCashAsync(
                        connection, transaction, userId, mutation.PortfolioId,
                        mutation.Currency, mutation.WithdrawalDate, null, token).ConfigureAwait(false);
                    if (!PortfolioCashCalculator.Withdraw(available, mutation.Amount).Allowed)
                    {
                        return PortfolioMutationResult.Conflicted(
                            $"Only {available:0.########} {mutation.Currency.Trim().ToUpperInvariant()} is available.");
                    }

                    await using var command = connection.CreateCommand();
                    command.Transaction = transaction;
                    command.CommandText = """
                        insert into public.portfolio_cash_withdrawals (
                          user_id, portfolio_id, currency, amount, withdrawal_date, notes)
                        values ($1, $2, $3, $4, $5, $6)
                        returning id;
                        """;
                    Add(command, NpgsqlDbType.Uuid, userId);
                    Add(command, NpgsqlDbType.Uuid, mutation.PortfolioId);
                    Add(command, NpgsqlDbType.Text, mutation.Currency.Trim().ToUpperInvariant());
                    Add(command, NpgsqlDbType.Numeric, mutation.Amount);
                    Add(command, NpgsqlDbType.Date, mutation.WithdrawalDate);
                    Add(command, NpgsqlDbType.Text,
                        string.IsNullOrWhiteSpace(mutation.Notes) ? null : mutation.Notes.Trim());
                    var id = (Guid)(await command.ExecuteScalarAsync(token).ConfigureAwait(false))!;
                    await PortfolioAccountingGuard.ValidateAsync(connection, transaction, userId, token)
                        .ConfigureAwait(false);
                    return PortfolioMutationResult.Succeeded(id);
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (PortfolioAccountingConflictException exception)
        {
            return PortfolioMutationResult.Conflicted(exception.Message);
        }
    }

    private static async Task<bool> OwnsPortfolioAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid? portfolioId,
        CancellationToken cancellationToken)
    {
        if (portfolioId is null) return true;
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select exists(select 1 from public.portfolios where id = $1 and user_id = $2);";
        Add(command, NpgsqlDbType.Uuid, portfolioId);
        Add(command, NpgsqlDbType.Uuid, userId);
        return (bool)(await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false))!;
    }

    private static void Add(NpgsqlCommand command, NpgsqlDbType type, object? value) =>
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = type, Value = value ?? DBNull.Value });
}
