using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using PortfolioTerminal.Api;
using PortfolioTerminal.Api.Auth;
using PortfolioTerminal.Api.Endpoints;
using PortfolioTerminal.Api.Health;
using PortfolioTerminal.CarService.Analytics;
using PortfolioTerminal.CarService.Reminders;
using PortfolioTerminal.CarService.Visits;
using PortfolioTerminal.CarService.Vehicles;
using PortfolioTerminal.Data;
using PortfolioTerminal.Portfolio.Portfolios;
using PortfolioTerminal.Portfolio.Holdings;
using PortfolioTerminal.Portfolio.MarketData;
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
builder.Services.AddHttpClient<IQuoteService, YahooQuoteService>(client =>
{
    client.BaseAddress = new Uri("https://query1.finance.yahoo.com/");
    client.DefaultRequestHeaders.UserAgent.ParseAdd("portfolio-terminal/1.0");
    client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
});
builder.Services.AddHttpClient<IFxRateService, FxRateService>(client =>
{
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
builder.Services.AddScoped<IPortfolioQueries, PortfolioQueries>();
builder.Services.AddScoped<IPortfolioCommands, PortfolioCommands>();
builder.Services.AddScoped<IPortfolioHoldingQueries, PortfolioHoldingQueries>();
builder.Services.AddScoped<IPortfolioSnapshotQueries, PortfolioSnapshotQueries>();
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

builder.Services.AddHealthChecks()
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy(), ["live"])
    .AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors("Frontend");
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

app.Run();

public partial class Program;
