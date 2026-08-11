using Npgsql;
using System.Data;

namespace PortfolioTerminal.Data;

/// <summary>
/// Owns the application's PostgreSQL connection pool. Supabase SQL migrations remain
/// the source of truth for the schema; this type only provides runtime connections.
/// </summary>
public sealed class AppDataSource : IAsyncDisposable
{
    private readonly NpgsqlDataSource? _dataSource;

    public AppDataSource(string? connectionString)
    {
        if (!string.IsNullOrWhiteSpace(connectionString))
        {
            var builder = new NpgsqlDataSourceBuilder(connectionString);
            _dataSource = builder.Build();
        }
    }

    public bool IsConfigured => _dataSource is not null;

    public ValueTask<NpgsqlConnection> OpenConnectionAsync(
        CancellationToken cancellationToken = default)
    {
        if (_dataSource is null)
        {
            throw new InvalidOperationException(
                "The AppDatabase connection string has not been configured.");
        }

        return _dataSource.OpenConnectionAsync(cancellationToken);
    }

    /// <summary>
    /// Executes work in a short transaction with the Supabase authenticated role and
    /// JWT subject configured locally. Existing RLS policies therefore remain active
    /// even though the API connects directly to PostgreSQL.
    /// </summary>
    public async Task<T> ExecuteAsUserAsync<T>(
        Guid userId,
        Func<NpgsqlConnection, NpgsqlTransaction, CancellationToken, Task<T>> operation,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(operation);

        await using var connection = await OpenConnectionAsync(cancellationToken)
            .ConfigureAwait(false);
        await using var transaction = await connection
            .BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken)
            .ConfigureAwait(false);

        await SetUserContextAsync(connection, transaction, userId, cancellationToken)
            .ConfigureAwait(false);

        var result = await operation(connection, transaction, cancellationToken)
            .ConfigureAwait(false);

        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return result;
    }

    /// <summary>
    /// Executes trusted background work with the configured database role. This path
    /// is reserved for system jobs that must process every user's rows and must never
    /// be called from a user-controlled HTTP request.
    /// </summary>
    public async Task<T> ExecuteAsSystemAsync<T>(
        Func<NpgsqlConnection, NpgsqlTransaction, CancellationToken, Task<T>> operation,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(operation);

        await using var connection = await OpenConnectionAsync(cancellationToken)
            .ConfigureAwait(false);
        await using var transaction = await connection
            .BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken)
            .ConfigureAwait(false);

        var result = await operation(connection, transaction, cancellationToken)
            .ConfigureAwait(false);
        await transaction.CommitAsync(cancellationToken).ConfigureAwait(false);
        return result;
    }

    private static async Task SetUserContextAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using (var claimsCommand = connection.CreateCommand())
        {
            claimsCommand.Transaction = transaction;
            claimsCommand.CommandText = """
                select
                    set_config('request.jwt.claim.sub', $1, true),
                    set_config('request.jwt.claim.role', 'authenticated', true),
                    set_config(
                        'request.jwt.claims',
                        json_build_object('sub', $1, 'role', 'authenticated')::text,
                        true);
                """;
            claimsCommand.Parameters.AddWithValue(userId.ToString());
            await claimsCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }

        await using var roleCommand = connection.CreateCommand();
        roleCommand.Transaction = transaction;
        roleCommand.CommandText = "set local role authenticated;";
        await roleCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    public async ValueTask DisposeAsync()
    {
        if (_dataSource is not null)
        {
            await _dataSource.DisposeAsync().ConfigureAwait(false);
        }
    }
}
