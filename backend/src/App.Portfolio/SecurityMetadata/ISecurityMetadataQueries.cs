namespace PortfolioTerminal.Portfolio.SecurityMetadata;

public interface ISecurityMetadataQueries
{
    Task<IReadOnlyDictionary<Guid, SecurityMetadataView>> GetByListingIdsAsync(
        Guid userId,
        IReadOnlyCollection<Guid> listingIds,
        CancellationToken cancellationToken = default);
}

public interface ISecurityListingResolver
{
    Task<SecurityListingResolution> ResolveAsync(
        SecurityListingResolutionRequest request,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, SecurityListingResolution>> ResolveManyAsync(
        IReadOnlyCollection<SecurityListingResolutionRequest> requests,
        CancellationToken cancellationToken = default);
}

public interface ISecurityMetadataProvider
{
    Task<ProviderSecurityMetadata> FetchAsync(
        SecurityMetadataRefreshClaim claim,
        CancellationToken cancellationToken = default);
}

public interface ISecurityMetadataCanonicalizer
{
    Task<CanonicalSecurityMetadata> CanonicalizeAsync(
        ProviderSecurityMetadata metadata,
        CancellationToken cancellationToken = default);
}

public interface ISecurityMetadataStore
{
    Task<IReadOnlyList<SecurityMetadataRefreshClaim>> ClaimAsync(
        int limit,
        bool force,
        CancellationToken cancellationToken = default);

    Task CompleteAsync(
        SecurityMetadataRefreshClaim claim,
        ProviderSecurityMetadata providerMetadata,
        CanonicalSecurityMetadata? canonicalMetadata,
        CancellationToken cancellationToken = default);

    Task ReleaseAsync(
        IReadOnlyCollection<Guid> listingIds,
        TimeSpan delay,
        CancellationToken cancellationToken = default);
}

public interface ISecurityMetadataRefreshJob
{
    Task<SecurityMetadataRefreshResult> RunAsync(
        SecurityMetadataRefreshRequest request,
        CancellationToken cancellationToken = default);
}
