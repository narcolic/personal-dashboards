namespace PortfolioTerminal.Portfolio;

public enum PortfolioMutationStatus
{
    Success,
    NotFound,
    Conflict,
}

public sealed record PortfolioMutationResult(
    PortfolioMutationStatus Status,
    Guid? Id = null,
    int AffectedCount = 0,
    string? Detail = null)
{
    public static PortfolioMutationResult Succeeded(
        Guid? id = null,
        int affectedCount = 0) =>
        new(PortfolioMutationStatus.Success, id, affectedCount);

    public static PortfolioMutationResult Missing(string detail) =>
        new(PortfolioMutationStatus.NotFound, Detail: detail);

    public static PortfolioMutationResult Conflicted(string detail) =>
        new(PortfolioMutationStatus.Conflict, Detail: detail);
}
