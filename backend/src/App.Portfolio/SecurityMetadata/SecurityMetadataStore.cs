using System.Security.Cryptography;
using System.Text;
using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.SecurityMetadata;

public sealed class SecurityMetadataStore(
    AppDataSource dataSource,
    SecurityMetadataOptions options) : ISecurityMetadataStore
{
    public Task<IReadOnlyList<SecurityMetadataRefreshClaim>> ClaimAsync(
        int limit,
        bool force,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsSystemAsync(
            (connection, transaction, token) => ClaimCoreAsync(
                connection, transaction, Math.Max(0, limit), force, token),
            cancellationToken);

    public Task CompleteAsync(
        SecurityMetadataRefreshClaim claim,
        ProviderSecurityMetadata providerMetadata,
        CanonicalSecurityMetadata? canonicalMetadata,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsSystemAsync(
            async (connection, transaction, token) =>
            {
                await UpsertObservationAsync(
                    connection, transaction, claim, providerMetadata, token).ConfigureAwait(false);

                if (providerMetadata.Status is ProviderMetadataStatus.Succeeded
                    or ProviderMetadataStatus.Incomplete)
                {
                    await ApplyCanonicalMetadataAsync(
                        connection, transaction, claim, providerMetadata,
                        canonicalMetadata, token).ConfigureAwait(false);
                    if (!await HasProviderIdentifierAsync(
                            connection, transaction, claim.ListingId,
                            providerMetadata.ProviderSymbol, token).ConfigureAwait(false))
                    {
                        providerMetadata = providerMetadata with
                        {
                            Status = ProviderMetadataStatus.Incomplete,
                            ErrorCode = "provider_identifier_conflict",
                            ErrorMessage =
                                "The Alpha Vantage symbol is already assigned to another listing and requires review.",
                        };
                    }
                }

                await UpdateRefreshStateAsync(
                    connection, transaction, claim.ListingId, providerMetadata,
                    canonicalMetadata, token).ConfigureAwait(false);
                return true;
            },
            cancellationToken);

    private static async Task<bool> HasProviderIdentifierAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid listingId,
        string providerSymbol,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select exists (
              select 1 from public.security_listing_provider_identifiers
              where listing_id = $1
                and provider_code = 'alpha_vantage'
                and provider_symbol = $2
            );
            """;
        AddUuid(command, listingId);
        command.Parameters.AddWithValue(providerSymbol.Trim().ToUpperInvariant());
        return (bool)(await command.ExecuteScalarAsync(cancellationToken)
            .ConfigureAwait(false))!;
    }

    public Task ReleaseAsync(
        IReadOnlyCollection<Guid> listingIds,
        TimeSpan delay,
        CancellationToken cancellationToken = default)
    {
        var ids = listingIds.Distinct().ToArray();
        if (ids.Length == 0)
        {
            return Task.CompletedTask;
        }

        return dataSource.ExecuteAsSystemAsync(
            async (connection, transaction, token) =>
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = """
                    update private.security_metadata_refresh_state
                    set status = 'pending',
                        next_attempt_at = now() + $2::interval,
                        updated_at = now()
                    where provider_code = 'alpha_vantage'
                      and status = 'processing'
                      and listing_id = any($1);
                    """;
                command.Parameters.Add(new NpgsqlParameter
                {
                    NpgsqlDbType = NpgsqlDbType.Array | NpgsqlDbType.Uuid,
                    Value = ids,
                });
                command.Parameters.Add(new NpgsqlParameter
                {
                    NpgsqlDbType = NpgsqlDbType.Interval,
                    Value = delay,
                });
                await command.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                return true;
            },
            cancellationToken);
    }

    private static async Task<IReadOnlyList<SecurityMetadataRefreshClaim>> ClaimCoreAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        int limit,
        bool force,
        CancellationToken cancellationToken)
    {
        if (limit == 0)
        {
            return [];
        }

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            with due as (
              select state.listing_id, state.provider_code
              from private.security_metadata_refresh_state state
              where state.provider_code = 'alpha_vantage'
                and (state.status <> 'processing'
                     or state.last_attempt_at < now() - interval '1 hour')
                and ($2 or state.next_attempt_at <= now()
                     or (state.stale_after is not null and state.stale_after <= now()))
              order by state.next_attempt_at, state.listing_id
              limit $1
              for update skip locked
            ), claimed as (
              update private.security_metadata_refresh_state state
              set status = 'processing', last_attempt_at = now(), updated_at = now()
              from due
              where state.listing_id = due.listing_id
                and state.provider_code = due.provider_code
              returning state.listing_id
            )
            select l.id, s.id, s.company_id, l.symbol, s.name,
                   s.security_type_code, l.trading_currency_code
            from claimed
            join public.security_listings l on l.id = claimed.listing_id
            join public.securities s on s.id = l.security_id
            order by l.symbol, l.id;
            """;
        command.Parameters.AddWithValue(limit);
        command.Parameters.AddWithValue(force);

        var claims = new List<SecurityMetadataRefreshClaim>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            claims.Add(new SecurityMetadataRefreshClaim(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.IsDBNull(2) ? null : reader.GetGuid(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetString(6)));
        }

        return claims;
    }

    private static async Task UpsertObservationAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        SecurityMetadataRefreshClaim claim,
        ProviderSecurityMetadata metadata,
        CancellationToken cancellationToken)
    {
        var json = metadata.SanitizedAttributes.GetRawText();
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))
            .ToLowerInvariant();
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            insert into private.security_metadata_provider_observations(
              listing_id, provider_code, attributes, payload_hash, retrieved_at)
            values ($1, 'alpha_vantage', $2, $3, now())
            on conflict (listing_id, provider_code) do update
            set attributes = excluded.attributes,
                payload_hash = excluded.payload_hash,
                retrieved_at = excluded.retrieved_at,
                updated_at = now();
            """;
        AddUuid(command, claim.ListingId);
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Jsonb,
            Value = json,
        });
        command.Parameters.AddWithValue(hash);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task ApplyCanonicalMetadataAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        SecurityMetadataRefreshClaim claim,
        ProviderSecurityMetadata provider,
        CanonicalSecurityMetadata? canonical,
        CancellationToken cancellationToken)
    {
        var companyId = await ResolveCompanyAsync(
            connection, transaction, claim, provider, canonical, cancellationToken)
            .ConfigureAwait(false);
        await using var batch = new NpgsqlBatch(connection, transaction);

        var updateIdentifier = new NpgsqlBatchCommand("""
            update public.security_listing_provider_identifiers identifier
            set provider_symbol = $2, last_verified_at = now(), updated_at = now()
            where identifier.listing_id = $1
              and identifier.provider_code = 'alpha_vantage'
              and not exists (
                select 1 from public.security_listing_provider_identifiers other
                where other.provider_code = 'alpha_vantage'
                  and other.provider_symbol = $2
                  and other.listing_id <> $1
              );
            """);
        AddUuid(updateIdentifier, claim.ListingId);
        updateIdentifier.Parameters.AddWithValue(provider.ProviderSymbol.Trim().ToUpperInvariant());
        batch.BatchCommands.Add(updateIdentifier);

        var insertIdentifier = new NpgsqlBatchCommand("""
            insert into public.security_listing_provider_identifiers(
              listing_id, provider_code, provider_symbol, last_verified_at)
            values ($1, 'alpha_vantage', $2, now())
            on conflict do nothing;
            """);
        AddUuid(insertIdentifier, claim.ListingId);
        insertIdentifier.Parameters.AddWithValue(provider.ProviderSymbol.Trim().ToUpperInvariant());
        batch.BatchCommands.Add(insertIdentifier);

        var updateListing = new NpgsqlBatchCommand("""
            update public.security_listings listing
            set exchange_id = case
                  when $2::uuid is not null and not exists (
                    select 1 from private.metadata_field_locks lock
                    where lock.listing_id = listing.id and lock.field_name = 'exchange_id'
                  ) then $2::uuid else listing.exchange_id end,
                trading_currency_code = case
                  when $3::text is not null and not exists (
                    select 1 from private.metadata_field_locks lock
                    where lock.listing_id = listing.id
                      and lock.field_name = 'trading_currency_code'
                  ) then upper($3::text) else listing.trading_currency_code end,
                status = case when listing.status = 'provisional' then 'active' else listing.status end,
                updated_at = now()
            where listing.id = $1;
            """);
        AddUuid(updateListing, claim.ListingId);
        AddNullableUuid(updateListing, canonical?.ExchangeId);
        AddNullableText(updateListing, NormalizeCurrency(provider.Currency));
        batch.BatchCommands.Add(updateListing);

        var updateSecurity = new NpgsqlBatchCommand("""
            update public.securities security
            set security_type_code = case
                  when $2::text is not null and not exists (
                    select 1 from private.metadata_field_locks lock
                    where lock.security_id = security.id
                      and lock.field_name = 'security_type_code'
                  ) then $2::text else security.security_type_code end,
                name = case
                  when $3::text is not null and not exists (
                    select 1 from private.metadata_field_locks lock
                    where lock.security_id = security.id and lock.field_name = 'name'
                  ) then $3::text else security.name end,
                updated_at = now()
            where security.id = $1;
            """);
        AddUuid(updateSecurity, claim.SecurityId);
        AddNullableText(updateSecurity, canonical?.SecurityTypeCode);
        AddNullableText(updateSecurity, TrimToNull(provider.Name));
        batch.BatchCommands.Add(updateSecurity);

        var updateCompany = new NpgsqlBatchCommand("""
            update public.companies company
            set legal_name = case
                  when $2::text is not null and not exists (
                    select 1 from private.metadata_field_locks lock
                    where lock.company_id = company.id and lock.field_name = 'legal_name'
                  ) then $2::text else company.legal_name end,
                country_code = case
                  when $3::text is not null and not exists (
                    select 1 from private.metadata_field_locks lock
                    where lock.company_id = company.id and lock.field_name = 'country_code'
                  ) then $3::text else company.country_code end,
                sector_code = case
                  when $4::text is not null and not exists (
                    select 1 from private.metadata_field_locks lock
                    where lock.company_id = company.id and lock.field_name = 'sector_code'
                  ) then $4::text else company.sector_code end,
                industry_code = case
                  when $5::text is not null and not exists (
                    select 1 from private.metadata_field_locks lock
                    where lock.company_id = company.id and lock.field_name = 'industry_code'
                  ) then $5::text else company.industry_code end,
                updated_at = now()
            where company.id = $1::uuid;
            """);
        AddNullableUuid(updateCompany, companyId);
        AddNullableText(updateCompany, TrimToNull(provider.CompanyName));
        AddNullableText(updateCompany, canonical?.CountryCode);
        AddNullableText(updateCompany, canonical?.SectorCode);
        AddNullableText(updateCompany, canonical?.IndustryCode);
        batch.BatchCommands.Add(updateCompany);

        var upsertCompanyIdentifier = new NpgsqlBatchCommand("""
            insert into public.company_provider_identifiers(
              company_id, provider_code, provider_company_id)
            select $1::uuid, 'alpha_vantage', $2::text
            where $1::uuid is not null and $2::text is not null
            on conflict (company_id, provider_code) do update
            set provider_company_id = excluded.provider_company_id,
                updated_at = now();
            """);
        AddNullableUuid(upsertCompanyIdentifier, companyId);
        AddNullableText(upsertCompanyIdentifier, TrimToNull(provider.ProviderCompanyId));
        batch.BatchCommands.Add(upsertCompanyIdentifier);

        await batch.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task<Guid?> ResolveCompanyAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        SecurityMetadataRefreshClaim claim,
        ProviderSecurityMetadata provider,
        CanonicalSecurityMetadata? canonical,
        CancellationToken cancellationToken)
    {
        if (!string.Equals(canonical?.SecurityTypeCode, "stock", StringComparison.Ordinal)
            && !string.Equals(claim.SecurityType, "stock", StringComparison.Ordinal))
        {
            return claim.CompanyId;
        }

        Guid? companyId = null;
        if (!string.IsNullOrWhiteSpace(provider.ProviderCompanyId))
        {
            await using var find = connection.CreateCommand();
            find.Transaction = transaction;
            find.CommandText = """
                select company_id
                from public.company_provider_identifiers
                where provider_code = 'alpha_vantage' and provider_company_id = $1;
                """;
            find.Parameters.AddWithValue(provider.ProviderCompanyId.Trim());
            companyId = await find.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false)
                is Guid existing ? existing : null;
        }

        companyId ??= claim.CompanyId;
        if (companyId is null)
        {
            await using var create = connection.CreateCommand();
            create.Transaction = transaction;
            create.CommandText = """
                insert into public.companies(legal_name)
                values ($1)
                returning id;
                """;
            create.Parameters.AddWithValue(
                TrimToNull(provider.CompanyName) ?? TrimToNull(provider.Name) ?? claim.Name);
            companyId = (Guid)(await create.ExecuteScalarAsync(cancellationToken)
                .ConfigureAwait(false))!;
        }

        if (companyId != claim.CompanyId)
        {
            await using var attach = connection.CreateCommand();
            attach.Transaction = transaction;
            attach.CommandText = """
                update public.securities security
                set company_id = $2, updated_at = now()
                where security.id = $1
                  and not exists (
                    select 1 from private.metadata_field_locks lock
                    where lock.security_id = security.id and lock.field_name = 'company_id'
                  );
                """;
            AddUuid(attach, claim.SecurityId);
            AddUuid(attach, companyId.Value);
            var attached = await attach.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            if (attached > 0 && claim.CompanyId is { } previousCompanyId)
            {
                await using var cleanup = connection.CreateCommand();
                cleanup.Transaction = transaction;
                cleanup.CommandText = """
                    delete from public.companies company
                    where company.id = $1
                      and not exists (
                        select 1 from public.securities security
                        where security.company_id = company.id
                      )
                      and not exists (
                        select 1 from public.company_provider_identifiers identifier
                        where identifier.company_id = company.id
                      );
                    """;
                AddUuid(cleanup, previousCompanyId);
                await cleanup.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
            }
        }

        return companyId;
    }

    private async Task UpdateRefreshStateAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid listingId,
        ProviderSecurityMetadata provider,
        CanonicalSecurityMetadata? canonical,
        CancellationToken cancellationToken)
    {
        var status = provider.Status switch
        {
            ProviderMetadataStatus.Succeeded when canonical?.HasUnmappedValues != true => "succeeded",
            ProviderMetadataStatus.Succeeded or ProviderMetadataStatus.Incomplete => "incomplete",
            ProviderMetadataStatus.NotFound => "not_found",
            ProviderMetadataStatus.RateLimited => "rate_limited",
            _ => "failed",
        };
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            update private.security_metadata_refresh_state
            set status = $2,
                last_success_at = case
                  when $2 in ('succeeded', 'incomplete') then now() else last_success_at end,
                stale_after = case
                  when $2 = 'succeeded' then now() + make_interval(days => $3)
                  else null end,
                next_attempt_at = case
                  when $2 = 'succeeded' then now() + make_interval(days => $3)
                  when $2 in ('incomplete', 'not_found') then now() + make_interval(days => $4)
                  when $2 = 'rate_limited' then date_trunc('day', now()) + interval '1 day'
                  else now() + make_interval(days => least(30, power(2, least(failure_count, 5))::int))
                end,
                failure_count = case
                  when $2 in ('succeeded', 'incomplete') then 0 else failure_count + 1 end,
                error_code = $5,
                error_message = $6,
                updated_at = now()
            where listing_id = $1 and provider_code = 'alpha_vantage';
            """;
        AddUuid(command, listingId);
        command.Parameters.AddWithValue(status);
        command.Parameters.AddWithValue(Math.Max(1, options.StaleAfterDays));
        command.Parameters.AddWithValue(Math.Max(1, options.IncompleteRetryDays));
        AddNullableText(command, TrimToNull(provider.ErrorCode));
        AddNullableText(command, Bound(provider.ErrorMessage));
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static string? NormalizeCurrency(string? value)
    {
        var result = value?.Trim().ToUpperInvariant();
        return result is { Length: >= 3 and <= 5 } ? result : null;
    }

    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? Bound(string? value) =>
        value is null ? null : value.Length <= 500 ? value : value[..500];

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

    private static void AddUuid(NpgsqlBatchCommand command, Guid value) =>
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Uuid, Value = value });

    private static void AddNullableUuid(NpgsqlBatchCommand command, Guid? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = (object?)value ?? DBNull.Value,
        });

    private static void AddNullableText(NpgsqlBatchCommand command, string? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Text,
            Value = (object?)value ?? DBNull.Value,
        });
}
