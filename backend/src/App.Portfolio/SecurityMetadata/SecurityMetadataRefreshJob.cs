namespace PortfolioTerminal.Portfolio.SecurityMetadata;

public sealed class SecurityMetadataRefreshJob(
    ISecurityMetadataProvider provider,
    ISecurityMetadataCanonicalizer canonicalizer,
    ISecurityMetadataStore store,
    SecurityMetadataOptions options,
    AlphaVantageOptions alphaVantageOptions) : ISecurityMetadataRefreshJob
{
    public async Task<SecurityMetadataRefreshResult> RunAsync(
        SecurityMetadataRefreshRequest request,
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(options.Provider, "AlphaVantage", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(alphaVantageOptions.ApiKey))
        {
            return new SecurityMetadataRefreshResult(false, 0, 0, 0, 0, 0, 0, 0);
        }

        var requestBudget = Math.Max(1, options.MaxRequestsPerRun);
        var requestedItems = Math.Max(1, request.Limit ?? options.MaxItemsPerRun);
        // SYMBOL_SEARCH plus one profile call is the maximum for one listing.
        var claimLimit = Math.Min(requestedItems, Math.Max(1, requestBudget / 2));
        var claims = await store.ClaimAsync(claimLimit, request.Force, cancellationToken)
            .ConfigureAwait(false);

        var processed = 0;
        var requests = 0;
        var succeeded = 0;
        var incomplete = 0;
        var failed = 0;
        var rateLimited = 0;

        foreach (var claim in claims)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (requests >= requestBudget)
            {
                await store.ReleaseAsync(
                    claims.Skip(processed).Select(item => item.ListingId).ToArray(),
                    TimeSpan.Zero,
                    cancellationToken).ConfigureAwait(false);
                break;
            }

            var source = await provider.FetchAsync(claim, cancellationToken).ConfigureAwait(false);
            requests += source.RequestsConsumed;
            CanonicalSecurityMetadata? canonical = null;
            if (source.Status is ProviderMetadataStatus.Succeeded
                or ProviderMetadataStatus.Incomplete)
            {
                canonical = await canonicalizer.CanonicalizeAsync(source, cancellationToken)
                    .ConfigureAwait(false);
            }

            await store.CompleteAsync(claim, source, canonical, cancellationToken)
                .ConfigureAwait(false);
            processed++;
            switch (source.Status)
            {
                case ProviderMetadataStatus.Succeeded when canonical?.HasUnmappedValues != true:
                    succeeded++;
                    break;
                case ProviderMetadataStatus.Succeeded:
                case ProviderMetadataStatus.Incomplete:
                    incomplete++;
                    break;
                case ProviderMetadataStatus.RateLimited:
                    rateLimited++;
                    break;
                default:
                    failed++;
                    break;
            }

            if (source.Status == ProviderMetadataStatus.RateLimited)
            {
                await store.ReleaseAsync(
                    claims.Skip(processed).Select(item => item.ListingId).ToArray(),
                    TimeSpan.FromDays(1),
                    cancellationToken).ConfigureAwait(false);
                break;
            }
        }

        return new SecurityMetadataRefreshResult(
            true, claims.Count, processed, requests, succeeded, incomplete, failed, rateLimited);
    }
}
