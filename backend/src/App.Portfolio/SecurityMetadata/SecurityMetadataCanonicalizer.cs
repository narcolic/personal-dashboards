using System.Globalization;
using System.Text;
using Npgsql;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Portfolio.SecurityMetadata;

public sealed class SecurityMetadataCanonicalizer(AppDataSource dataSource)
    : ISecurityMetadataCanonicalizer
{
    public Task<CanonicalSecurityMetadata> CanonicalizeAsync(
        ProviderSecurityMetadata metadata,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsSystemAsync(
            async (connection, transaction, token) =>
            {
                var securityType = await MapCodeAsync(
                    connection, transaction, "security_type", metadata.SecurityType, token)
                    .ConfigureAwait(false);
                var country = await MapCodeAsync(
                    connection, transaction, "country", metadata.Country, token)
                    .ConfigureAwait(false);
                var sector = await MapCodeAsync(
                    connection, transaction, "sector", metadata.Sector, token)
                    .ConfigureAwait(false);
                var industry = await MapCodeAsync(
                    connection, transaction, "industry", metadata.Industry, token)
                    .ConfigureAwait(false);
                var industryMappingConflictsWithSector = false;
                if (industry is not null && sector is not null)
                {
                    await using var parentCommand = connection.CreateCommand();
                    parentCommand.Transaction = transaction;
                    parentCommand.CommandText =
                        "select sector_code from public.industries where code = $1;";
                    parentCommand.Parameters.AddWithValue(industry);
                    var parentSector = await parentCommand.ExecuteScalarAsync(token)
                        .ConfigureAwait(false) as string;
                    if (!string.Equals(parentSector, sector, StringComparison.Ordinal))
                    {
                        industry = null;
                        industryMappingConflictsWithSector = true;
                    }
                }
                if (industry is null
                    && sector is not null
                    && !industryMappingConflictsWithSector
                    && !string.IsNullOrWhiteSpace(metadata.Industry))
                {
                    industry = await DiscoverIndustryAsync(
                            connection, transaction, metadata.Industry, sector, token)
                        .ConfigureAwait(false);
                }
                var exchangeCode = await MapCodeAsync(
                    connection, transaction, "exchange", metadata.Exchange, token)
                    .ConfigureAwait(false);
                Guid? exchangeId = null;
                if (exchangeCode is not null)
                {
                    await using var exchangeCommand = connection.CreateCommand();
                    exchangeCommand.Transaction = transaction;
                    exchangeCommand.CommandText = "select id from public.exchanges where code = $1;";
                    exchangeCommand.Parameters.AddWithValue(exchangeCode);
                    exchangeId = await exchangeCommand.ExecuteScalarAsync(token)
                        .ConfigureAwait(false) is Guid value ? value : null;
                }

                var unmapped = IsUnmapped(metadata.SecurityType, securityType)
                    || IsUnmapped(metadata.Country, country)
                    || IsUnmapped(metadata.Sector, sector)
                    || IsUnmapped(metadata.Industry, industry)
                    || IsUnmapped(metadata.Exchange, exchangeCode);
                return new CanonicalSecurityMetadata(
                    securityType, country, sector, industry, exchangeId, unmapped);
            },
            cancellationToken);

    private static async Task<string?> MapCodeAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string dimension,
        string? providerValue,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(providerValue))
        {
            return null;
        }

        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = dimension switch
        {
            "security_type" => """
                select mapping.canonical_code
                from private.metadata_provider_mappings mapping
                join public.security_types target on target.code = mapping.canonical_code
                where mapping.provider_code = 'alpha_vantage'
                  and mapping.dimension = $1
                  and mapping.provider_value = lower(btrim($2));
                """,
            "country" => """
                select mapping.canonical_code
                from private.metadata_provider_mappings mapping
                join public.countries target on target.code = mapping.canonical_code
                where mapping.provider_code = 'alpha_vantage'
                  and mapping.dimension = $1
                  and mapping.provider_value = lower(btrim($2));
                """,
            "sector" => """
                select mapping.canonical_code
                from private.metadata_provider_mappings mapping
                join public.sectors target on target.code = mapping.canonical_code
                where mapping.provider_code = 'alpha_vantage'
                  and mapping.dimension = $1
                  and mapping.provider_value = lower(btrim($2));
                """,
            "industry" => """
                select mapping.canonical_code
                from private.metadata_provider_mappings mapping
                join public.industries target on target.code = mapping.canonical_code
                where mapping.provider_code = 'alpha_vantage'
                  and mapping.dimension = $1
                  and mapping.provider_value = lower(btrim($2));
                """,
            "exchange" => """
                select mapping.canonical_code
                from private.metadata_provider_mappings mapping
                join public.exchanges target on target.code = mapping.canonical_code
                where mapping.provider_code = 'alpha_vantage'
                  and mapping.dimension = $1
                  and mapping.provider_value = lower(btrim($2));
                """,
            _ => throw new InvalidOperationException(
                $"Unsupported metadata mapping dimension '{dimension}'."),
        };
        command.Parameters.AddWithValue(dimension);
        command.Parameters.AddWithValue(providerValue);
        return await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false) as string;
    }

    private static bool IsUnmapped(string? providerValue, string? canonicalValue) =>
        !string.IsNullOrWhiteSpace(providerValue) && canonicalValue is null;

    private static async Task<string?> DiscoverIndustryAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string providerValue,
        string sectorCode,
        CancellationToken cancellationToken)
    {
        var normalizedProviderValue = providerValue.Trim().ToLowerInvariant();
        var displayName = NormalizeIndustryName(providerValue);
        var industryCode = NormalizeIndustryCode(providerValue);
        if (displayName is null || industryCode is null)
        {
            return null;
        }

        var existing = await FindIndustryByNameAsync(
                connection, transaction, sectorCode, displayName, cancellationToken)
            .ConfigureAwait(false);
        if (existing is null)
        {
            await InsertDiscoveredIndustryAsync(
                    connection, transaction, industryCode, sectorCode, displayName,
                    cancellationToken)
                .ConfigureAwait(false);
            existing = await FindIndustryByNameAsync(
                    connection, transaction, sectorCode, displayName, cancellationToken)
                .ConfigureAwait(false);
        }

        if (existing is null)
        {
            var sectorScopedCode = NormalizeIndustryCode($"{sectorCode}_{industryCode}");
            if (sectorScopedCode is null)
            {
                return null;
            }

            await InsertDiscoveredIndustryAsync(
                    connection, transaction, sectorScopedCode, sectorCode, displayName,
                    cancellationToken)
                .ConfigureAwait(false);
            existing = await FindIndustryByNameAsync(
                    connection, transaction, sectorCode, displayName, cancellationToken)
                .ConfigureAwait(false);
        }

        if (existing is null)
        {
            return null;
        }

        await using var mapping = connection.CreateCommand();
        mapping.Transaction = transaction;
        mapping.CommandText = """
            insert into private.metadata_provider_mappings(
              provider_code, dimension, provider_value, canonical_code, review_status)
            values ('alpha_vantage', 'industry', $1, $2, 'discovered')
            on conflict (provider_code, dimension, provider_value) do nothing;
            """;
        mapping.Parameters.AddWithValue(normalizedProviderValue);
        mapping.Parameters.AddWithValue(existing);
        await mapping.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        return await MapCodeAsync(
                connection, transaction, "industry", providerValue, cancellationToken)
            .ConfigureAwait(false);
    }

    private static async Task InsertDiscoveredIndustryAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string industryCode,
        string sectorCode,
        string displayName,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            insert into public.industries(
              code, sector_code, name, source_provider_code, review_status)
            values ($1, $2, $3, 'alpha_vantage', 'discovered')
            on conflict do nothing;
            """;
        command.Parameters.AddWithValue(industryCode);
        command.Parameters.AddWithValue(sectorCode);
        command.Parameters.AddWithValue(displayName);
        await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
    }

    private static async Task<string?> FindIndustryByNameAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string sectorCode,
        string displayName,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select code
            from public.industries
            where sector_code = $1 and lower(btrim(name)) = lower(btrim($2))
            order by case review_status when 'approved' then 0 else 1 end, code
            limit 1;
            """;
        command.Parameters.AddWithValue(sectorCode);
        command.Parameters.AddWithValue(displayName);
        return await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false)
            as string;
    }

    internal static string? NormalizeIndustryName(string value)
    {
        var normalized = string.Join(' ', value.Split(
            (char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (normalized.Length == 0)
        {
            return null;
        }

        normalized = normalized.Length <= 120 ? normalized : normalized[..120].TrimEnd();
        return CultureInfo.InvariantCulture.TextInfo.ToTitleCase(normalized.ToLowerInvariant());
    }

    internal static string? NormalizeIndustryCode(string value)
    {
        var decomposed = value.Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(Math.Min(decomposed.Length, 80));
        var pendingSeparator = false;
        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            var normalized = char.ToLowerInvariant(character);
            if (normalized is >= 'a' and <= 'z' or >= '0' and <= '9')
            {
                if (pendingSeparator && builder.Length > 0 && builder.Length < 80)
                {
                    builder.Append('_');
                }
                if (builder.Length < 80)
                {
                    builder.Append(normalized);
                }
                pendingSeparator = false;
            }
            else
            {
                pendingSeparator = true;
            }
        }

        var result = builder.ToString().TrimEnd('_');
        if (result.Length == 0)
        {
            return null;
        }
        return result[0] is >= 'a' and <= 'z' ? result : $"industry_{result}";
    }
}
