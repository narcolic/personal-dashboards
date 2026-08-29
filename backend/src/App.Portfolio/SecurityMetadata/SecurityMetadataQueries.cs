using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.SecurityMetadata;

public sealed class SecurityMetadataQueries(AppDataSource dataSource) : ISecurityMetadataQueries
{
    public Task<IReadOnlyDictionary<Guid, SecurityMetadataView>> GetByListingIdsAsync(
        Guid userId,
        IReadOnlyCollection<Guid> listingIds,
        CancellationToken cancellationToken = default)
    {
        var ids = listingIds.Distinct().ToArray();
        if (ids.Length == 0)
        {
            return Task.FromResult<IReadOnlyDictionary<Guid, SecurityMetadataView>>(
                new Dictionary<Guid, SecurityMetadataView>());
        }

        // Canonical metadata is global read-all data. Use the trusted connection so
        // metadata status and lock provenance remain inaccessible to authenticated SQL.
        return dataSource.ExecuteAsSystemAsync(
            (connection, transaction, token) => ReadAsync(connection, transaction, ids, token),
            cancellationToken);
    }

    private static async Task<IReadOnlyDictionary<Guid, SecurityMetadataView>> ReadAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid[] listingIds,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select
              l.id, s.id, l.symbol, s.name, s.security_type_code,
              e.mic, e.name, l.trading_currency_code,
              c.legal_name, c.country_code, country.name, region.code, region.name,
              c.sector_code, sector.name, c.industry_code, industry.name,
              s.primary_market_country_code, primary_country.name,
              s.geographic_exposure_code, geography.name,
              s.market_exposure_category_code, market_exposure.name,
              coalesce(refresh.status, 'pending'), refresh.last_success_at,
              exists (
                select 1 from private.metadata_field_locks lock
                where lock.company_id = c.id or lock.security_id = s.id or lock.listing_id = l.id
              )
            from public.security_listings l
            join public.securities s on s.id = l.security_id
            left join public.exchanges e on e.id = l.exchange_id
            left join public.companies c on c.id = s.company_id
            left join public.countries country on country.code = c.country_code
            left join public.regions region on region.code = country.region_code
            left join public.sectors sector on sector.code = c.sector_code
            left join public.industries industry on industry.code = c.industry_code
            left join public.countries primary_country
              on primary_country.code = s.primary_market_country_code
            left join public.geographic_exposures geography
              on geography.code = s.geographic_exposure_code
            left join public.market_exposure_categories market_exposure
              on market_exposure.code = s.market_exposure_category_code
            left join private.security_metadata_refresh_state refresh
              on refresh.listing_id = l.id and refresh.provider_code = 'alpha_vantage'
            where l.id = any($1)
            order by l.id;
            """;
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Array | NpgsqlDbType.Uuid,
            Value = listingIds,
        });

        var result = new Dictionary<Guid, SecurityMetadataView>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            var item = new SecurityMetadataView(
                reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
                reader.GetString(4), NullableString(reader, 5), NullableString(reader, 6),
                NullableString(reader, 7), NullableString(reader, 8), NullableString(reader, 9),
                NullableString(reader, 10), NullableString(reader, 11), NullableString(reader, 12),
                NullableString(reader, 13), NullableString(reader, 14), NullableString(reader, 15),
                NullableString(reader, 16), NullableString(reader, 17), NullableString(reader, 18),
                NullableString(reader, 19), NullableString(reader, 20), NullableString(reader, 21),
                NullableString(reader, 22), reader.GetString(23),
                reader.IsDBNull(24) ? null : reader.GetFieldValue<DateTimeOffset>(24),
                reader.GetBoolean(25));
            result[item.ListingId] = item;
        }

        return result;
    }

    private static string? NullableString(NpgsqlDataReader reader, int ordinal) =>
        reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
}
