using System.Text.Json;

namespace PortfolioTerminal.Portfolio.SecurityMetadata;

public sealed record SecurityMetadataView(
    Guid ListingId,
    Guid SecurityId,
    string Symbol,
    string Name,
    string SecurityType,
    string? ExchangeMic,
    string? ExchangeName,
    string? TradingCurrency,
    string? CompanyName,
    string? CountryCode,
    string? CountryName,
    string? RegionCode,
    string? RegionName,
    string? SectorCode,
    string? SectorName,
    string? IndustryCode,
    string? IndustryName,
    string? PrimaryMarketCountryCode,
    string? PrimaryMarketCountryName,
    string? GeographicExposureCode,
    string? GeographicExposureName,
    string? MarketExposureCode,
    string? MarketExposureName,
    string MetadataStatus,
    DateTimeOffset? MetadataUpdatedAt,
    bool IsOverridden)
{
    public string? EffectiveGeography =>
        string.Equals(SecurityType, "stock", StringComparison.OrdinalIgnoreCase)
            ? CountryName ?? RegionName
            : GeographicExposureName;

    public string? GeographySource => EffectiveGeography is null
        ? null
        : string.Equals(SecurityType, "stock", StringComparison.OrdinalIgnoreCase)
            ? CountryName is not null ? "company_country" : "company_region"
            : "etf_geographic_exposure";

    public string MetadataSource => IsOverridden
        ? MetadataUpdatedAt is null ? "manual" : "mixed"
        : "provider";
}

public sealed record SecurityListingResolutionRequest(
    Guid? ListingId,
    string Symbol,
    string? Name,
    string SecurityType,
    string? Market,
    string? TradingCurrency);

public sealed record SecurityListingResolution(
    Guid ListingId,
    string Symbol,
    bool Created);

public sealed record SecurityMetadataRefreshClaim(
    Guid ListingId,
    Guid SecurityId,
    Guid? CompanyId,
    string Symbol,
    string Name,
    string SecurityType,
    string? TradingCurrency,
    string? ProviderSymbol = null);

public enum ProviderMetadataStatus
{
    Succeeded,
    Incomplete,
    NotFound,
    Failed,
    RateLimited,
}

public sealed record ProviderSecurityMetadata(
    ProviderMetadataStatus Status,
    string ProviderSymbol,
    string? Name,
    string? SecurityType,
    string? Exchange,
    string? Currency,
    string? CompanyName,
    string? ProviderCompanyId,
    string? Country,
    string? Sector,
    string? Industry,
    JsonElement SanitizedAttributes,
    int RequestsConsumed,
    string? ErrorCode = null,
    string? ErrorMessage = null);

public sealed record CanonicalSecurityMetadata(
    string? SecurityTypeCode,
    string? CountryCode,
    string? SectorCode,
    string? IndustryCode,
    Guid? ExchangeId,
    bool HasUnmappedValues);

public sealed record SecurityMetadataRefreshRequest(
    bool Force = false,
    int? Limit = null);

public sealed record SecurityMetadataRefreshResult(
    bool Configured,
    int Claimed,
    int Processed,
    int RequestsConsumed,
    int Succeeded,
    int Incomplete,
    int Failed,
    int RateLimited);

public sealed class SecurityMetadataOptions
{
    public string Provider { get; set; } = "AlphaVantage";
    public int StaleAfterDays { get; set; } = 90;
    public int IncompleteRetryDays { get; set; } = 30;
    public int MaxRequestsPerRun { get; set; } = 20;
    public int MaxItemsPerRun { get; set; } = 20;
}

public sealed class AlphaVantageOptions
{
    public string? ApiKey { get; set; }
    public int RequestIntervalMilliseconds { get; set; } = 1100;
}
