namespace PortfolioTerminal.CarService;

public enum MutationStatus
{
    Success,
    NotFound,
    Conflict,
}

public sealed record MutationResult(MutationStatus Status, Guid? Id = null, string? Detail = null)
{
    public static MutationResult Succeeded(Guid? id = null) =>
        new(MutationStatus.Success, id);

    public static MutationResult Missing(string detail) =>
        new(MutationStatus.NotFound, Detail: detail);

    public static MutationResult Conflicted(string detail) =>
        new(MutationStatus.Conflict, Detail: detail);
}
