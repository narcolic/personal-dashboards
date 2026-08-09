using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace PortfolioTerminal.Tests;

internal sealed class JwksTestHandler : HttpMessageHandler
{
    private static readonly string[] VerifyKeyOperations = ["verify"];
    private readonly Uri _expectedUri;
    private readonly string _jwksJson;
    private int _requestCount;

    public JwksTestHandler(Uri expectedUri, ECParameters publicKey, string keyId)
    {
        _expectedUri = expectedUri;
        _jwksJson = JsonSerializer.Serialize(new
        {
            keys = new[]
            {
                new
                {
                    alg = "ES256",
                    crv = "P-256",
                    ext = true,
                    key_ops = VerifyKeyOperations,
                    kid = keyId,
                    kty = "EC",
                    use = "sig",
                    x = Base64UrlEncoder.Encode(publicKey.Q.X),
                    y = Base64UrlEncoder.Encode(publicKey.Q.Y),
                },
            },
        });
    }

    public int RequestCount => Volatile.Read(ref _requestCount);

    public Uri? RequestUri { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref _requestCount);
        RequestUri = request.RequestUri;

        if (request.Method != HttpMethod.Get || request.RequestUri != _expectedUri)
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.NotFound));
        }

        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(_jwksJson, Encoding.UTF8, "application/json"),
        });
    }
}
