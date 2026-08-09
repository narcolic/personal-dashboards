using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace PortfolioTerminal.Api.Auth;

internal sealed class SupabaseOpenIdConfigurationManager(
    IHttpClientFactory httpClientFactory,
    IOptions<SupabaseAuthOptions> options,
    TimeProvider timeProvider)
    : IConfigurationManager<OpenIdConnectConfiguration>, IDisposable
{
    public const string HttpClientName = "SupabaseAuth";

    private readonly SemaphoreSlim _refreshLock = new(1, 1);
    private OpenIdConnectConfiguration? _configuration;
    private DateTimeOffset _refreshAfter = DateTimeOffset.MinValue;

    public async Task<OpenIdConnectConfiguration> GetConfigurationAsync(
        CancellationToken cancel)
    {
        if (_configuration is not null && timeProvider.GetUtcNow() < _refreshAfter)
        {
            return _configuration;
        }

        await _refreshLock.WaitAsync(cancel).ConfigureAwait(false);
        try
        {
            if (_configuration is not null && timeProvider.GetUtcNow() < _refreshAfter)
            {
                return _configuration;
            }

            var auth = options.Value;
            var client = httpClientFactory.CreateClient(HttpClientName);
            using var response = await client.GetAsync(auth.JwksUri, cancel).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadAsStringAsync(cancel).ConfigureAwait(false);
            var keySet = new JsonWebKeySet(json);

            if (keySet.Keys.Count == 0)
            {
                throw new InvalidOperationException(
                    "Supabase returned no asymmetric JWT signing keys. " +
                    "Rotate the project from the legacy HS256 JWT secret before enabling the API.");
            }

            var configuration = new OpenIdConnectConfiguration
            {
                Issuer = auth.Issuer,
                JwksUri = auth.JwksUri.ToString(),
            };

            foreach (var key in keySet.Keys)
            {
                configuration.SigningKeys.Add(key);
            }

            _configuration = configuration;
            _refreshAfter = timeProvider.GetUtcNow().AddMinutes(auth.JwksRefreshMinutes);

            return configuration;
        }
        catch when (_configuration is not null)
        {
            // A temporary Supabase outage should not invalidate already cached keys.
            _refreshAfter = timeProvider.GetUtcNow().AddMinutes(1);
            return _configuration;
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    public void RequestRefresh() => _refreshAfter = DateTimeOffset.MinValue;

    public void Dispose() => _refreshLock.Dispose();
}
