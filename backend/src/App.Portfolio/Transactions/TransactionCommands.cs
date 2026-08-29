using System.Text.Json;
using System.Text.Json.Serialization;
using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio.SecurityMetadata;

namespace PortfolioTerminal.Portfolio.Transactions;

public sealed class TransactionCommands(
    AppDataSource dataSource,
    ISecurityListingResolver listingResolver) : ITransactionCommands
{
    public async Task<PortfolioMutationResult> CreateAsync(
        Guid userId,
        TransactionMutation mutation,
        CancellationToken cancellationToken = default)
    {
        mutation = await ResolveAsync(mutation, cancellationToken).ConfigureAwait(false);
        return await dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                if (!await OwnsPortfolioAsync(
                        connection,
                        transaction,
                        userId,
                        mutation.PortfolioId,
                        token).ConfigureAwait(false))
                {
                    return PortfolioMutationResult.Missing("Portfolio not found.");
                }

                var id = await InsertTransactionAsync(
                    connection,
                    transaction,
                    userId,
                    mutation,
                    token).ConfigureAwait(false);
                await UpsertTickerAsync(
                    connection,
                    transaction,
                    userId,
                    mutation,
                    token).ConfigureAwait(false);
                return PortfolioMutationResult.Succeeded(id);
            },
            cancellationToken).ConfigureAwait(false);
    }

    public async Task<PortfolioMutationResult> UpdateAsync(
        Guid userId,
        Guid transactionId,
        TransactionMutation mutation,
        CancellationToken cancellationToken = default)
    {
        mutation = await ResolveAsync(mutation, cancellationToken).ConfigureAwait(false);
        return await dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                if (!await LockOwnedTransactionAsync(
                        connection,
                        transaction,
                        userId,
                        transactionId,
                        token).ConfigureAwait(false))
                {
                    return PortfolioMutationResult.Missing("Transaction not found.");
                }

                if (!await OwnsPortfolioAsync(
                        connection,
                        transaction,
                        userId,
                        mutation.PortfolioId,
                        token).ConfigureAwait(false))
                {
                    return PortfolioMutationResult.Missing("Portfolio not found.");
                }

                await using (var command = connection.CreateCommand())
                {
                    command.Transaction = transaction;
                    command.CommandText = """
                        update public.transactions
                        set ticker = $3, action = $4, name = $5, asset_type = $6,
                            market = $7, currency = $8, shares = $9, price = $10,
                            transaction_date = $11, notes = $12, portfolio_id = $13,
                            security_listing_id = $14
                        where id = $1 and user_id = $2
                        returning id;
                        """;
                    AddUuid(command, transactionId);
                    AddUuid(command, userId);
                    AddTransactionParameters(command, mutation);
                    await command.ExecuteScalarAsync(token).ConfigureAwait(false);
                }

                await UpsertTickerAsync(
                    connection,
                    transaction,
                    userId,
                    mutation,
                    token).ConfigureAwait(false);
                return PortfolioMutationResult.Succeeded(transactionId);
            },
            cancellationToken).ConfigureAwait(false);
    }

    public Task<PortfolioMutationResult> DeleteAsync(
        Guid userId,
        Guid transactionId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = """
                    delete from public.transactions
                    where id = $1 and user_id = $2
                    returning id;
                    """;
                AddUuid(command, transactionId);
                AddUuid(command, userId);
                return await command.ExecuteScalarAsync(token).ConfigureAwait(false) is Guid
                    ? PortfolioMutationResult.Succeeded(affectedCount: 1)
                    : PortfolioMutationResult.Missing("Transaction not found.");
            },
            cancellationToken);

    public Task<PortfolioMutationResult> DeleteManyAsync(
        Guid userId,
        IReadOnlyCollection<Guid> transactionIds,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                var ids = transactionIds.Distinct().ToArray();
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = """
                    delete from public.transactions
                    where user_id = $1 and id = any($2);
                    """;
                AddUuid(command, userId);
                command.Parameters.Add(new NpgsqlParameter
                {
                    NpgsqlDbType = NpgsqlDbType.Array | NpgsqlDbType.Uuid,
                    Value = ids,
                });
                var deleted = await command.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                return PortfolioMutationResult.Succeeded(affectedCount: deleted);
            },
            cancellationToken);

    public async Task<PortfolioMutationResult> ImportAsync(
        Guid userId,
        TransactionImportMutation mutation,
        CancellationToken cancellationToken = default)
    {
        var resolutions = await listingResolver.ResolveManyAsync(
            mutation.Rows.Select(row => new SecurityListingResolutionRequest(
                row.SecurityListingId, row.Ticker, row.Name, row.AssetType,
                null, row.Currency)).ToArray(),
            cancellationToken).ConfigureAwait(false);
        var resolvedMutation = mutation with
        {
            Rows = mutation.Rows.Select(row => row with
            {
                SecurityListingId = resolutions[NormalizeTicker(row.Ticker)].ListingId,
            }).ToArray(),
        };

        return await dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                var portfolios = await ReadPortfolioMapAsync(
                    connection,
                    transaction,
                    userId,
                    token).ConfigureAwait(false);
                var rows = new List<TransactionJsonRow>(resolvedMutation.Rows.Count);

                foreach (var row in resolvedMutation.Rows)
                {
                    var portfolioName = row.PortfolioName.Trim();
                    if (!portfolios.TryGetValue(portfolioName, out var portfolioId))
                    {
                        portfolioId = await InsertImportedPortfolioAsync(
                            connection,
                            transaction,
                            userId,
                            portfolioName,
                            resolvedMutation.ImportedPortfolioNotes,
                            token).ConfigureAwait(false);
                        portfolios[portfolioName] = portfolioId;
                    }

                    rows.Add(TransactionJsonRow.From(row, portfolioId));
                }

                var inserted = await InsertImportedTransactionsAsync(
                    connection,
                    transaction,
                    userId,
                    rows,
                    token).ConfigureAwait(false);
                await UpsertImportedTickersAsync(
                    connection,
                    transaction,
                    userId,
                    rows,
                    token).ConfigureAwait(false);
                return PortfolioMutationResult.Succeeded(affectedCount: inserted);
            },
            cancellationToken).ConfigureAwait(false);
    }

    private static async Task<Guid> InsertTransactionAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        TransactionMutation mutation,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            insert into public.transactions (
                user_id, ticker, action, name, asset_type, market, currency,
                shares, price, transaction_date, notes, portfolio_id, security_listing_id)
            values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            returning id;
            """;
        AddUuid(command, userId);
        AddTransactionParameters(command, mutation);
        return (Guid)(await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false))!;
    }

    private static async Task UpsertTickerAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        TransactionMutation mutation,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            insert into public.ticker_catalog (
                user_id, ticker, name, asset_type, market, currency,
                security_listing_id, is_active)
            values ($1, $2, $3, $4, $5, $6, $7, true)
            on conflict (user_id, ticker) do update
            set name = excluded.name,
                asset_type = excluded.asset_type,
                market = excluded.market,
                currency = excluded.currency,
                security_listing_id = excluded.security_listing_id,
                is_active = true;
            """;
        AddUuid(command, userId);
        command.Parameters.AddWithValue(NormalizeTicker(mutation.Ticker));
        AddNullableText(command, mutation.Name);
        command.Parameters.AddWithValue(mutation.AssetType.Trim().ToLowerInvariant());
        AddNullableText(command, mutation.Market);
        command.Parameters.AddWithValue(mutation.Currency.Trim().ToUpperInvariant());
        AddNullableUuid(command, mutation.SecurityListingId);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task<Dictionary<string, Guid>> ReadPortfolioMapAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id, name from public.portfolios where user_id = $1;
            """;
        AddUuid(command, userId);
        var portfolios = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            portfolios.TryAdd(reader.GetString(1).Trim(), reader.GetGuid(0));
        }
        return portfolios;
    }

    private static async Task<Guid> InsertImportedPortfolioAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        string name,
        string? notes,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            insert into public.portfolios (user_id, name, broker, notes)
            values ($1, $2, $2, $3)
            returning id;
            """;
        AddUuid(command, userId);
        command.Parameters.AddWithValue(name);
        AddNullableText(command, notes);
        return (Guid)(await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false))!;
    }

    private static async Task<int> InsertImportedTransactionsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        IReadOnlyList<TransactionJsonRow> rows,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            insert into public.transactions (
                user_id, ticker, action, name, asset_type, market, currency,
                shares, price, transaction_date, notes, portfolio_id, security_listing_id)
            select $1, x.ticker, x.action, x.name, x.asset_type, x.market,
                   x.currency, x.shares, x.price, x.transaction_date,
                   x.notes, x.portfolio_id, x.security_listing_id
            from jsonb_to_recordset($2) as x(
                ticker text, action text, name text, asset_type text, market text,
                currency text, shares numeric, price numeric,
                transaction_date date, notes text, portfolio_id uuid,
                security_listing_id uuid);
            """;
        AddUuid(command, userId);
        AddJson(command, rows);
        return await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task UpsertImportedTickersAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        IReadOnlyList<TransactionJsonRow> rows,
        CancellationToken cancellationToken)
    {
        var tickers = rows
            .GroupBy(row => row.Ticker, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.Last())
            .ToArray();
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            insert into public.ticker_catalog (
                user_id, ticker, name, asset_type, market, currency,
                security_listing_id, is_active)
            select $1, x.ticker, x.name, x.asset_type, x.market, x.currency,
                   x.security_listing_id, true
            from jsonb_to_recordset($2) as x(
                ticker text, name text, asset_type text, market text, currency text,
                security_listing_id uuid)
            on conflict (user_id, ticker) do update
            set name = excluded.name,
                asset_type = excluded.asset_type,
                market = excluded.market,
                currency = excluded.currency,
                security_listing_id = excluded.security_listing_id,
                is_active = true;
            """;
        AddUuid(command, userId);
        AddJson(command, tickers);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task<bool> OwnsPortfolioAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid? portfolioId,
        CancellationToken cancellationToken)
    {
        if (portfolioId is null)
        {
            return true;
        }

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select exists(
                select 1 from public.portfolios where id = $1 and user_id = $2
            );
            """;
        AddUuid(command, portfolioId.Value);
        AddUuid(command, userId);
        return (bool)(await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false))!;
    }

    private static async Task<bool> LockOwnedTransactionAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid transactionId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id from public.transactions
            where id = $1 and user_id = $2
            for update;
            """;
        AddUuid(command, transactionId);
        AddUuid(command, userId);
        return await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false) is Guid;
    }

    private static void AddTransactionParameters(
        NpgsqlCommand command,
        TransactionMutation mutation)
    {
        command.Parameters.AddWithValue(NormalizeTicker(mutation.Ticker));
        command.Parameters.AddWithValue(mutation.Action.Trim().ToLowerInvariant());
        AddNullableText(command, mutation.Name);
        command.Parameters.AddWithValue(mutation.AssetType.Trim().ToLowerInvariant());
        AddNullableText(command, mutation.Market);
        command.Parameters.AddWithValue(mutation.Currency.Trim().ToUpperInvariant());
        command.Parameters.AddWithValue(mutation.Shares);
        command.Parameters.AddWithValue(mutation.Price);
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Date,
            Value = mutation.TransactionDate,
        });
        AddNullableText(command, mutation.Notes);
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = (object?)mutation.PortfolioId ?? DBNull.Value,
        });
        AddNullableUuid(command, mutation.SecurityListingId);
    }

    private static void AddJson<T>(NpgsqlCommand command, T value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Jsonb,
            Value = JsonSerializer.Serialize(value),
        });

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

    private static void AddNullableUuid(NpgsqlCommand command, Guid? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = (object?)value ?? DBNull.Value,
        });

    private static string NormalizeTicker(string ticker) =>
        ticker.Trim().ToUpperInvariant();

    private sealed record TransactionJsonRow(
        [property: JsonPropertyName("ticker")] string Ticker,
        [property: JsonPropertyName("action")] string Action,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("asset_type")] string AssetType,
        [property: JsonPropertyName("market")] string? Market,
        [property: JsonPropertyName("currency")] string Currency,
        [property: JsonPropertyName("shares")] decimal Shares,
        [property: JsonPropertyName("price")] decimal Price,
        [property: JsonPropertyName("transaction_date")] DateOnly TransactionDate,
        [property: JsonPropertyName("notes")] string? Notes,
        [property: JsonPropertyName("portfolio_id")] Guid PortfolioId,
        [property: JsonPropertyName("security_listing_id")] Guid SecurityListingId)
    {
        public static TransactionJsonRow From(
            ImportedTransactionMutation row,
            Guid portfolioId) =>
            new(
                NormalizeTicker(row.Ticker),
                "buy",
                TrimToNull(row.Name),
                row.AssetType.Trim().ToLowerInvariant(),
                null,
                row.Currency.Trim().ToUpperInvariant(),
                row.Shares,
                row.Price,
                row.TransactionDate,
                TrimToNull(row.Notes),
                portfolioId,
                row.SecurityListingId ?? throw new InvalidOperationException(
                    "Imported transaction listing resolution was not completed."));
    }

    private async Task<TransactionMutation> ResolveAsync(
        TransactionMutation mutation,
        CancellationToken cancellationToken)
    {
        var resolution = await listingResolver.ResolveAsync(
            new SecurityListingResolutionRequest(
                mutation.SecurityListingId,
                mutation.Ticker,
                mutation.Name,
                mutation.AssetType,
                mutation.Market,
                mutation.Currency),
            cancellationToken).ConfigureAwait(false);
        return mutation with
        {
            Ticker = resolution.Symbol,
            SecurityListingId = resolution.ListingId,
        };
    }

    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
