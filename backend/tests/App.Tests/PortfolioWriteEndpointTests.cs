using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioTerminal.Portfolio;
using PortfolioTerminal.Portfolio.Portfolios;
using PortfolioTerminal.Portfolio.SecurityMetadata;
using PortfolioTerminal.Portfolio.Transactions;

namespace PortfolioTerminal.Tests;

public sealed class PortfolioWriteEndpointTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly Guid UserId = Guid.Parse(TestAuthHandler.UserId);

    [Fact]
    public async Task PortfolioCreateRequiresBearerToken()
    {
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/portfolio/portfolios", new
        {
            name = "Main",
            broker = "Broker",
            notes = "Notes",
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task PortfolioCreateUsesCurrentUserAndReturnsCreatedId()
    {
        var portfolioId = Guid.NewGuid();
        var commands = new RecordingPortfolioCommands(
            PortfolioMutationResult.Succeeded(portfolioId));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<IPortfolioCommands>();
            services.AddSingleton<IPortfolioCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/portfolio/portfolios", new
        {
            name = "Main",
            broker = "Example Broker",
            notes = "Long term",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        Assert.Equal("Main", commands.Mutation!.Name);
        Assert.Equal("Example Broker", commands.Mutation.Broker);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(portfolioId.ToString(), payload.GetProperty("id").GetString());
    }

    [Fact]
    public async Task MissingPortfolioDeleteReturnsNotFound()
    {
        var portfolioId = Guid.NewGuid();
        var commands = new RecordingPortfolioCommands(
            PortfolioMutationResult.Missing("Portfolio not found."));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<IPortfolioCommands>();
            services.AddSingleton<IPortfolioCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.DeleteAsync($"/api/portfolio/portfolios/{portfolioId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        Assert.Equal(portfolioId, commands.RequestedId);
    }

    [Fact]
    public async Task TransactionCreateForwardsFinancialValuesAndReturnsCreatedId()
    {
        var portfolioId = Guid.NewGuid();
        var listingId = Guid.NewGuid();
        var transactionId = Guid.NewGuid();
        var commands = new RecordingTransactionCommands(
            PortfolioMutationResult.Succeeded(transactionId));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<ITransactionCommands>();
            services.AddSingleton<ITransactionCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/portfolio/transactions",
            TransactionBody(portfolioId, listingId));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        Assert.Equal(listingId, commands.Mutation!.SecurityListingId);
        Assert.Equal("USD", commands.Mutation.TransactionCurrency);
        Assert.Equal(2.125m, commands.Mutation.Shares);
        Assert.Equal(181.2575m, commands.Mutation.Price);
        Assert.Equal(portfolioId, commands.Mutation.PortfolioId);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(transactionId.ToString(), payload.GetProperty("id").GetString());
    }

    [Fact]
    public async Task InvalidTransactionIsRejectedBeforeCommandRuns()
    {
        var commands = new RecordingTransactionCommands(
            PortfolioMutationResult.Succeeded(Guid.NewGuid()));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<ITransactionCommands>();
            services.AddSingleton<ITransactionCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/portfolio/transactions", new
        {
            ticker = "invalid ticker!",
            action = "buy",
            asset_type = "stock",
            currency = "USD",
            shares = -1m,
            price = 10m,
            transaction_date = "2026-08-11",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(commands.RequestedUserId);
    }

    [Fact]
    public async Task MissingTransactionUpdateReturnsNotFound()
    {
        var transactionId = Guid.NewGuid();
        var commands = new RecordingTransactionCommands(
            PortfolioMutationResult.Missing("Transaction not found."));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<ITransactionCommands>();
            services.AddSingleton<ITransactionCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PutAsJsonAsync(
            $"/api/portfolio/transactions/{transactionId}",
            TransactionBody(null, Guid.NewGuid()));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        Assert.Equal(transactionId, commands.RequestedId);
    }

    [Fact]
    public async Task NewSymbolResolutionCreatesAProvisionalListing()
    {
        var listingId = Guid.NewGuid();
        var resolver = new RecordingListingResolver(
            new SecurityListingResolution(listingId, "NEW.DE", true));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<ISecurityListingResolver>();
            services.AddSingleton<ISecurityListingResolver>(resolver);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/portfolio/security-listings/resolve",
            new
            {
                symbol = "new.de",
                name = "New Security",
                security_type = "stock",
                market = "XETRA",
                trading_currency = "EUR",
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("new.de", resolver.Request!.Symbol);
        Assert.Equal("stock", resolver.Request.SecurityType);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(listingId.ToString(), payload.GetProperty("listing_id").GetString());
        Assert.True(payload.GetProperty("created").GetBoolean());
    }

    [Fact]
    public async Task BulkDeleteReturnsActualOwnedRowCount()
    {
        var ids = new[] { Guid.NewGuid(), Guid.NewGuid() };
        var commands = new RecordingTransactionCommands(
            PortfolioMutationResult.Succeeded(affectedCount: 1));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<ITransactionCommands>();
            services.AddSingleton<ITransactionCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/portfolio/transactions/bulk-delete",
            new { ids });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        Assert.Equal(ids, commands.RequestedIds);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, payload.GetProperty("deleted").GetInt32());
    }

    [Fact]
    public async Task CsvImportForwardsRowsAndReturnsInsertedCount()
    {
        var commands = new RecordingTransactionCommands(
            PortfolioMutationResult.Succeeded(affectedCount: 2));
        using var authenticatedFactory = CreateAuthenticatedFactory(services =>
        {
            services.RemoveAll<ITransactionCommands>();
            services.AddSingleton<ITransactionCommands>(commands);
        });
        using var client = authenticatedFactory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/portfolio/transactions/import",
            new
            {
                importedPortfolioNotes = "Imported via CSV",
                rows = new[]
                {
                    new
                    {
                        ticker = "AAPL",
                        name = "Apple",
                        asset_type = "stock",
                        currency = "USD",
                        shares = 2.5m,
                        price = 180.25m,
                        transaction_date = "2026-08-10",
                        notes = (string?)null,
                        portfolio_name = "IBKR",
                    },
                    new
                    {
                        ticker = "AIR.PA",
                        name = "Airbus",
                        asset_type = "stock",
                        currency = "EUR",
                        shares = 1m,
                        price = 140m,
                        transaction_date = "2026-08-11",
                        notes = (string?)null,
                        portfolio_name = "Degiro",
                    },
                },
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(UserId, commands.RequestedUserId);
        Assert.Equal("Imported via CSV", commands.ImportMutation!.ImportedPortfolioNotes);
        Assert.Equal(2, commands.ImportMutation.Rows.Count);
        Assert.Equal("IBKR", commands.ImportMutation.Rows[0].PortfolioName);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(2, payload.GetProperty("inserted").GetInt32());
    }

    private WebApplicationFactory<Program> CreateAuthenticatedFactory(
        Action<IServiceCollection> configureServices) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                configureServices(services);
                services.AddAuthentication(options =>
                    {
                        options.DefaultAuthenticateScheme = TestAuthHandler.SchemeName;
                        options.DefaultChallengeScheme = TestAuthHandler.SchemeName;
                    })
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        TestAuthHandler.SchemeName,
                        _ => { });
            });
        });

    private static object TransactionBody(Guid? portfolioId, Guid listingId) => new
    {
        action = "buy",
        transaction_currency = "USD",
        shares = 2.125m,
        price = 181.2575m,
        transaction_date = "2026-08-11",
        notes = "Example",
        portfolio_id = portfolioId,
        security_listing_id = listingId,
    };

    private sealed class RecordingPortfolioCommands(
        PortfolioMutationResult result) : IPortfolioCommands
    {
        public Guid? RequestedUserId { get; private set; }
        public Guid? RequestedId { get; private set; }
        public PortfolioMutation? Mutation { get; private set; }

        public Task<PortfolioMutationResult> CreateAsync(
            Guid userId,
            PortfolioMutation mutation,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            Mutation = mutation;
            return Task.FromResult(result);
        }

        public Task<PortfolioMutationResult> DeleteAsync(
            Guid userId,
            Guid portfolioId,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            RequestedId = portfolioId;
            return Task.FromResult(result);
        }
    }

    private sealed class RecordingTransactionCommands(
        PortfolioMutationResult result) : ITransactionCommands
    {
        public Guid? RequestedUserId { get; private set; }
        public Guid? RequestedId { get; private set; }
        public IReadOnlyCollection<Guid>? RequestedIds { get; private set; }
        public TransactionMutation? Mutation { get; private set; }
        public TransactionImportMutation? ImportMutation { get; private set; }

        public Task<PortfolioMutationResult> CreateAsync(
            Guid userId,
            TransactionMutation mutation,
            CancellationToken cancellationToken = default) =>
            Record(userId, null, mutation);

        public Task<PortfolioMutationResult> UpdateAsync(
            Guid userId,
            Guid transactionId,
            TransactionMutation mutation,
            CancellationToken cancellationToken = default) =>
            Record(userId, transactionId, mutation);

        public Task<PortfolioMutationResult> DeleteAsync(
            Guid userId,
            Guid transactionId,
            CancellationToken cancellationToken = default) =>
            Record(userId, transactionId, null);

        public Task<PortfolioMutationResult> DeleteManyAsync(
            Guid userId,
            IReadOnlyCollection<Guid> transactionIds,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            RequestedIds = transactionIds;
            return Task.FromResult(result);
        }

        public Task<PortfolioMutationResult> ImportAsync(
            Guid userId,
            TransactionImportMutation mutation,
            CancellationToken cancellationToken = default)
        {
            RequestedUserId = userId;
            ImportMutation = mutation;
            return Task.FromResult(result);
        }

        private Task<PortfolioMutationResult> Record(
            Guid userId,
            Guid? id,
            TransactionMutation? mutation)
        {
            RequestedUserId = userId;
            RequestedId = id;
            Mutation = mutation;
            return Task.FromResult(result);
        }
    }

    private sealed class RecordingListingResolver(SecurityListingResolution result)
        : ISecurityListingResolver
    {
        public SecurityListingResolutionRequest? Request { get; private set; }

        public Task<SecurityListingResolution> ResolveAsync(
            SecurityListingResolutionRequest request,
            CancellationToken cancellationToken = default)
        {
            Request = request;
            return Task.FromResult(result);
        }

        public Task<IReadOnlyDictionary<string, SecurityListingResolution>> ResolveManyAsync(
            IReadOnlyCollection<SecurityListingResolutionRequest> requests,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
