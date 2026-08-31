using PortfolioTerminal.Portfolio;

namespace PortfolioTerminal.Portfolio.Transactions;

public interface ITransactionCommands
{
    Task<PortfolioMutationResult> CreateAsync(
        Guid userId,
        TransactionMutation mutation,
        CancellationToken cancellationToken = default);

    Task<PortfolioMutationResult> UpdateAsync(
        Guid userId,
        Guid transactionId,
        TransactionMutation mutation,
        CancellationToken cancellationToken = default);

    Task<PortfolioMutationResult> DeleteAsync(
        Guid userId,
        Guid transactionId,
        CancellationToken cancellationToken = default);

    Task<PortfolioMutationResult> DeleteManyAsync(
        Guid userId,
        IReadOnlyCollection<Guid> transactionIds,
        CancellationToken cancellationToken = default);

    Task<PortfolioMutationResult> ImportAsync(
        Guid userId,
        TransactionImportMutation mutation,
        CancellationToken cancellationToken = default);
}

public sealed record TransactionMutation(
    string Action,
    string TransactionCurrency,
    decimal Shares,
    decimal Price,
    DateOnly TransactionDate,
    string? Notes,
    Guid? PortfolioId,
    Guid SecurityListingId);

public sealed record ImportedTransactionMutation(
    string Ticker,
    string? Name,
    string AssetType,
    string Currency,
    decimal Shares,
    decimal Price,
    DateOnly TransactionDate,
    string? Notes,
    string PortfolioName,
    Guid? SecurityListingId = null);

public sealed record TransactionImportMutation(
    IReadOnlyList<ImportedTransactionMutation> Rows,
    string? ImportedPortfolioNotes);
