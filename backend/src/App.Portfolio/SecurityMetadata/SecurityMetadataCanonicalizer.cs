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
                    }
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
}
