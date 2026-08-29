using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using ModelContextProtocol.Protocol;
using PortfolioTerminal.Api;
using PortfolioTerminal.Api.Auth;
using PortfolioTerminal.Api.Endpoints;
using PortfolioTerminal.Api.Health;
using PortfolioTerminal.Api.Mcp;
using PortfolioTerminal.CarService.Analytics;
using PortfolioTerminal.CarService.Reminders;
using PortfolioTerminal.CarService.Visits;
using PortfolioTerminal.CarService.Vehicles;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio.Analytics;
using PortfolioTerminal.Portfolio.Portfolios;
using PortfolioTerminal.Portfolio.Holdings;
using PortfolioTerminal.Portfolio.MarketData;
using PortfolioTerminal.Portfolio.SecurityMetadata;
using PortfolioTerminal.Portfolio.Snapshots;
using PortfolioTerminal.Portfolio.TickerCatalog;
using PortfolioTerminal.Portfolio.Transactions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddOpenApi("v1");
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();
builder.Services.AddSupabaseAuthentication(builder.Configuration);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("Mcp", context =>
        RateLimitPartition.GetTokenBucketLimiter(
            context.User.FindFirst("client_id")?.Value ??
            context.User.FindFirst("sub")?.Value ??
            context.Connection.RemoteIpAddress?.ToString() ??
            "anonymous",
            _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = 10,
                TokensPerPeriod = 10,
                ReplenishmentPeriod = TimeSpan.FromSeconds(20),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));
});

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (allowedOrigins.Length > 0)
        {
            policy.WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    });
});

builder.Services.AddSingleton(
    new AppDataSource(builder.Configuration.GetConnectionString("AppDatabase")));
builder.Services.AddSingleton(TimeProvider.System);
var securityMetadataOptions = builder.Configuration
    .GetSection("SecurityMetadata")
    .Get<SecurityMetadataOptions>() ?? new SecurityMetadataOptions();
var alphaVantageOptions = builder.Configuration
    .GetSection("AlphaVantage")
    .Get<AlphaVantageOptions>() ?? new AlphaVantageOptions();
alphaVantageOptions.ApiKey ??= builder.Configuration["ALPHAVANTAGE_API_KEY"];
builder.Services.AddSingleton(securityMetadataOptions);
builder.Services.AddSingleton(alphaVantageOptions);
builder.Services.AddHttpClient<IQuoteService, YahooQuoteService>(client =>
{
    client.BaseAddress = new Uri("https://query1.finance.yahoo.com/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("portfolio-terminal/1.0");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});
builder.Services.AddHttpClient<IFxRateService, FxRateService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("portfolio-terminal/1.0");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});
builder.Services.AddHttpClient<IMarketStatusService, MarketStatusService>(client =>
{
    client.DefaultRequestHeaders.UserAgent.ParseAdd("portfolio-terminal/1.0");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
    var apiKey = builder.Configuration["MarketHours:ApiKey"] ??
        builder.Configuration["MARKETHOURS_API_KEY"];
    if (!string.IsNullOrWhiteSpace(apiKey))
    {
        client.DefaultRequestHeaders.Add("X-API-Key", apiKey);
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
    }
});
builder.Services.AddHttpClient<ISecurityMetadataProvider, AlphaVantageSecurityMetadataProvider>(client =>
{
    client.BaseAddress = new Uri("https://www.alphavantage.co/");
    client.Timeout = TimeSpan.FromSeconds(20);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("portfolio-terminal/1.0");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});
builder.Services.AddScoped<ISecurityMetadataQueries, SecurityMetadataQueries>();
builder.Services.AddScoped<ISecurityListingResolver, SecurityListingResolver>();
builder.Services.AddScoped<ISecurityMetadataCanonicalizer, SecurityMetadataCanonicalizer>();
builder.Services.AddScoped<ISecurityMetadataStore, SecurityMetadataStore>();
builder.Services.AddScoped<ISecurityMetadataRefreshJob, SecurityMetadataRefreshJob>();
builder.Services.AddScoped<IPortfolioQueries, PortfolioQueries>();
builder.Services.AddScoped<IPortfolioCommands, PortfolioCommands>();
builder.Services.AddScoped<IPortfolioHoldingQueries, PortfolioHoldingQueries>();
builder.Services.AddScoped<IPortfolioSnapshotQueries, PortfolioSnapshotQueries>();
builder.Services.AddScoped<IPortfolioSnapshotStore, PortfolioSnapshotStore>();
builder.Services.AddScoped<IPortfolioSnapshotJob, PortfolioSnapshotJob>();
builder.Services.AddScoped<IPortfolioAnalysisService>(services => new PortfolioAnalysisService(
    services.GetRequiredService<IPortfolioQueries>(),
    services.GetRequiredService<IPortfolioHoldingQueries>(),
    services.GetRequiredService<IPortfolioSnapshotQueries>(),
    services.GetRequiredService<IQuoteService>(),
    services.GetRequiredService<IFxRateService>(),
    services.GetRequiredService<TimeProvider>(),
    services.GetRequiredService<IOptions<McpAuthOptions>>().Value.MaxHoldings));
builder.Services.AddScoped<ITickerCatalogQueries, TickerCatalogQueries>();
builder.Services.AddScoped<ITransactionQueries, TransactionQueries>();
builder.Services.AddScoped<ITransactionCommands, TransactionCommands>();
builder.Services.AddScoped<IVehicleQueries, VehicleQueries>();
builder.Services.AddScoped<IVehicleCommands, VehicleCommands>();
builder.Services.AddScoped<IServiceVisitQueries, ServiceVisitQueries>();
builder.Services.AddScoped<IServiceVisitCommands, ServiceVisitCommands>();
builder.Services.AddScoped<ICarServiceAnalytics, CarServiceAnalyticsService>();
builder.Services.AddScoped<IServiceReminderQueries, ServiceReminderQueries>();
builder.Services.AddScoped<IServiceReminderService, ServiceReminderService>();
builder.Services.AddScoped<IServiceReminderCommands, ServiceReminderCommands>();
builder.Services.AddMcpServer(options =>
    {
        options.ServerInfo = new Implementation
        {
            Name = "portfolio-terminal",
            Title = "Portfolio Terminal",
            Version = "1.0.0",
            Description = "Authenticated, read-only portfolio analysis tools.",
        };
        options.ServerInstructions =
            "Read-only Portfolio Terminal data. Never claim realized P&L or cash-flow-adjusted returns. " +
            "Use portfolio_list when a portfolio selector is unknown or ambiguous.";
    })
    .WithHttpTransport(options => options.Stateless = true)
    .WithTools<PortfolioMcpTools>();

builder.Services.AddHealthChecks()
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy(), ["live"])
    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapOpenApi();
app.MapGet("/", () => Results.Ok(new
{
    service = "Portfolio Terminal API",
    version = "v1",
}));

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("live"),
    ResponseWriter = HealthResponseWriter.WriteAsync,
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready"),
    ResponseWriter = HealthResponseWriter.WriteAsync,
});

app.MapIdentityEndpoints();
app.MapPortfolioEndpoints();
app.MapCarServiceEndpoints();

string[] oauthScopes = ["openid"];
string[] bearerMethods = ["header"];
IResult ProtectedResourceMetadata(IOptions<McpAuthOptions> options) => Results.Ok(new
{
    resource = options.Value.ResourceUri,
    authorization_servers = new[] { options.Value.AuthorizationServer },
    scopes_supported = oauthScopes,
    bearer_methods_supported = bearerMethods,
});

app.MapGet("/.well-known/oauth-protected-resource", ProtectedResourceMetadata)
    .AllowAnonymous();
app.MapGet("/.well-known/oauth-protected-resource/mcp", ProtectedResourceMetadata)
    .AllowAnonymous();
app.MapMcp("/mcp")
    .RequireAuthorization(McpAuthOptions.AuthorizationPolicy)
    .RequireRateLimiting("Mcp");

if (args.Any(argument => string.Equals(
        argument,
        "--run-security-metadata-refresh=true",
        StringComparison.OrdinalIgnoreCase)))
{
    var force = args.Any(argument => string.Equals(
        argument,
        "--metadata-force=true",
        StringComparison.OrdinalIgnoreCase));
    var limitArgument = args.FirstOrDefault(argument =>
        argument.StartsWith("--metadata-limit=", StringComparison.OrdinalIgnoreCase));
    int? limit = null;
    if (limitArgument is not null)
    {
        var rawLimit = limitArgument[(limitArgument.IndexOf('=') + 1)..];
        if (!int.TryParse(rawLimit, out var parsedLimit) || parsedLimit is < 1 or > 1000)
        {
            throw new InvalidOperationException("metadata-limit must be between 1 and 1000.");
        }
        limit = parsedLimit;
    }

    await using var scope = app.Services.CreateAsyncScope();
    var job = scope.ServiceProvider.GetRequiredService<ISecurityMetadataRefreshJob>();
    var result = await job.RunAsync(new SecurityMetadataRefreshRequest(force, limit));
    Console.WriteLine(JsonSerializer.Serialize(result));
    return;
}

if (args.Any(argument => string.Equals(
        argument,
        "--run-portfolio-snapshot=true",
        StringComparison.OrdinalIgnoreCase)))
{
    var force = args.Any(argument => string.Equals(
        argument,
        "--snapshot-force=true",
        StringComparison.OrdinalIgnoreCase));
    var dateArgument = args.FirstOrDefault(argument =>
        argument.StartsWith("--snapshot-date=", StringComparison.OrdinalIgnoreCase));
    DateOnly? snapshotDate = null;
    if (dateArgument is not null)
    {
        var rawDate = dateArgument[(dateArgument.IndexOf('=') + 1)..];
        if (!DateOnly.TryParseExact(
                rawDate,
                "yyyy-MM-dd",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None,
                out var parsedDate))
        {
            throw new InvalidOperationException("snapshot-date must use YYYY-MM-DD format.");
        }
        snapshotDate = parsedDate;
    }

    await using var scope = app.Services.CreateAsyncScope();
    var job = scope.ServiceProvider.GetRequiredService<IPortfolioSnapshotJob>();
    var result = await job.RunAsync(
        new PortfolioSnapshotRunRequest(force, snapshotDate));
    Console.WriteLine(JsonSerializer.Serialize(result));
    return;
}

app.Run();

public partial class Program;
