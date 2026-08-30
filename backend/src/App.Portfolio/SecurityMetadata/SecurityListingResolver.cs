using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.SecurityMetadata;

public sealed class SecurityListingResolver(AppDataSource dataSource) : ISecurityListingResolver
{
    public async Task<SecurityListingResolution> ResolveAsync(
        SecurityListingResolutionRequest request,
        CancellationToken cancellationToken = default)
    {
        var result = await ResolveManyAsync([request], cancellationToken).ConfigureAwait(false);
        return result[NormalizeSymbol(request.Symbol)];
    }

    public Task<IReadOnlyDictionary<string, SecurityListingResolution>> ResolveManyAsync(
        IReadOnlyCollection<SecurityListingResolutionRequest> requests,
        CancellationToken cancellationToken = default)
    {
        var distinct = requests
            .GroupBy(request => NormalizeSymbol(request.Symbol), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.Last() with { Symbol = group.Key })
            .OrderBy(request => request.Symbol, StringComparer.Ordinal)
            .ToArray();

        return dataSource.ExecuteAsSystemAsync(
            async (connection, transaction, token) =>
            {
                var resolved = new Dictionary<string, SecurityListingResolution>(
                    StringComparer.OrdinalIgnoreCase);
                foreach (var request in distinct)
                {
                    resolved[request.Symbol] = await ResolveOneAsync(
                        connection, transaction, request, token).ConfigureAwait(false);
                }
                return (IReadOnlyDictionary<string, SecurityListingResolution>)resolved;
            },
            cancellationToken);
    }

    private static async Task<SecurityListingResolution> ResolveOneAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        SecurityListingResolutionRequest request,
        CancellationToken cancellationToken)
    {
        if (request.ListingId is not null)
        {
            var byId = await FindByIdAsync(
                connection, transaction, request.ListingId.Value, cancellationToken)
                .ConfigureAwait(false);
            if (byId is null)
            {
                throw new InvalidOperationException("The supplied security listing does not exist.");
            }
            return byId;
        }

        var symbol = NormalizeSymbol(request.Symbol);
        await using (var lockCommand = connection.CreateCommand())
        {
            lockCommand.Transaction = transaction;
            lockCommand.CommandText =
                "select pg_advisory_xact_lock(hashtextextended('security-listing:yahoo:' || $1, 0));";
            lockCommand.Parameters.AddWithValue(symbol);
            await lockCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }

        var existing = await FindByProviderSymbolAsync(
            connection, transaction, symbol, cancellationToken).ConfigureAwait(false);
        if (existing is not null)
        {
            return existing;
        }

        var securityType = NormalizeSecurityType(request.SecurityType);
        Guid? companyId = null;
        if (securityType == "stock")
        {
            await using var companyCommand = connection.CreateCommand();
            companyCommand.Transaction = transaction;
            companyCommand.CommandText = """
                insert into public.companies(legal_name)
                values ($1)
                returning id;
                """;
            companyCommand.Parameters.AddWithValue(NameOrSymbol(request.Name, symbol));
            companyId = (Guid)(await companyCommand.ExecuteScalarAsync(cancellationToken)
                .ConfigureAwait(false))!;
        }

        Guid securityId;
        await using (var securityCommand = connection.CreateCommand())
        {
            securityCommand.Transaction = transaction;
            securityCommand.CommandText = """
                insert into public.securities(security_type_code, name, company_id)
                values ($1, $2, $3)
                returning id;
                """;
            securityCommand.Parameters.AddWithValue(securityType);
            securityCommand.Parameters.AddWithValue(NameOrSymbol(request.Name, symbol));
            AddNullableUuid(securityCommand, companyId);
            securityId = (Guid)(await securityCommand.ExecuteScalarAsync(cancellationToken)
                .ConfigureAwait(false))!;
        }

        var exchangeId = await FindExchangeAsync(
            connection, transaction, request.Market, cancellationToken).ConfigureAwait(false);
        Guid listingId;
        await using (var listingCommand = connection.CreateCommand())
        {
            listingCommand.Transaction = transaction;
            listingCommand.CommandText = """
                insert into public.security_listings(
                  security_id, symbol, exchange_id, trading_currency_code, status)
                values ($1, $2, $3, $4, $5)
                returning id;
                """;
            AddUuid(listingCommand, securityId);
            listingCommand.Parameters.AddWithValue(symbol);
            AddNullableUuid(listingCommand, exchangeId);
            AddNullableText(listingCommand, NormalizeCurrency(request.TradingCurrency));
            listingCommand.Parameters.AddWithValue(exchangeId is null ? "provisional" : "active");
            listingId = (Guid)(await listingCommand.ExecuteScalarAsync(cancellationToken)
                .ConfigureAwait(false))!;
        }

        await using (var providerCommand = connection.CreateCommand())
        {
            providerCommand.Transaction = transaction;
            providerCommand.CommandText = """
                insert into public.security_listing_provider_identifiers(
                  listing_id, provider_code, provider_symbol, last_verified_at)
                values ($1, 'yahoo', $2, now());

                insert into private.security_metadata_refresh_state(
                  listing_id, provider_code, status, next_attempt_at)
                values ($1, 'alpha_vantage', 'pending', now())
                on conflict (listing_id, provider_code) do nothing;
                """;
            AddUuid(providerCommand, listingId);
            providerCommand.Parameters.AddWithValue(symbol);
            await providerCommand.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }

        return new SecurityListingResolution(listingId, symbol, true);
    }

    private static async Task<SecurityListingResolution?> FindByIdAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid listingId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = "select id, symbol from public.security_listings where id = $1;";
        AddUuid(command, listingId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);
        return await reader.ReadAsync(cancellationToken).ConfigureAwait(false)
            ? new SecurityListingResolution(reader.GetGuid(0), reader.GetString(1), false)
            : null;
    }

    private static async Task<SecurityListingResolution?> FindByProviderSymbolAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string symbol,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select l.id, l.symbol
            from public.security_listing_provider_identifiers p
            join public.security_listings l on l.id = p.listing_id
            where p.provider_code = 'yahoo' and p.provider_symbol = $1;
            """;
        command.Parameters.AddWithValue(symbol);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);
        return await reader.ReadAsync(cancellationToken).ConfigureAwait(false)
            ? new SecurityListingResolution(reader.GetGuid(0), reader.GetString(1), false)
            : null;
    }

    private static async Task<Guid?> FindExchangeAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string? market,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(market))
        {
            return null;
        }

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id from public.exchanges
            where lower(code) = lower($1)
               or lower(coalesce(mic, '')) = lower($1)
               or lower(name) = lower($1)
            order by id
            limit 1;
            """;
        command.Parameters.AddWithValue(market.Trim());
        return await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false) is Guid id
            ? id
            : null;
    }

    private static string NormalizeSymbol(string value) => value.Trim().ToUpperInvariant();

    private static string NormalizeSecurityType(string value) =>
        value.Trim().ToLowerInvariant() switch
        {
            "stock" or "etf" or "fund" or "bond" or "crypto" or "other" =>
                value.Trim().ToLowerInvariant(),
            _ => "other",
        };

    private static string? NormalizeCurrency(string? value)
    {
        var normalized = value?.Trim().ToUpperInvariant();
        return normalized is { Length: >= 3 and <= 5 } ? normalized : null;
    }

    private static string NameOrSymbol(string? name, string symbol) =>
        string.IsNullOrWhiteSpace(name) ? symbol : name.Trim();

    private static void AddUuid(NpgsqlCommand command, Guid value) =>
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Uuid, Value = value });

    private static void AddNullableUuid(NpgsqlCommand command, Guid? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = (object?)value ?? DBNull.Value,
        });

    private static void AddNullableText(NpgsqlCommand command, string? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Text,
            Value = (object?)value ?? DBNull.Value,
        });
}
