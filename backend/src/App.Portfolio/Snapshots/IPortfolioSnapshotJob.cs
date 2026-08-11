namespace PortfolioTerminal.Portfolio.Snapshots;

public interface IPortfolioSnapshotJob
{
    Task<PortfolioSnapshotRunResult> RunAsync(
        PortfolioSnapshotRunRequest request,
        CancellationToken cancellationToken = default);
}

public sealed record PortfolioSnapshotRunRequest(
    bool Force = false,
    DateOnly? Date = null);

public sealed record PortfolioSnapshotRunResult(
    bool Ok,
    bool Skipped,
    string? Reason,
    DateOnly SnapshotDate,
    int Rows,
    int Users,
    int Symbols,
    IReadOnlyList<string> FailedSymbols);
