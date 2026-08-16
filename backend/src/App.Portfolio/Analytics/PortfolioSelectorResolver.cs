using PortfolioTerminal.Portfolio.Portfolios;

namespace PortfolioTerminal.Portfolio.Analytics;

public static class PortfolioSelectorResolver
{
    public static PortfolioAnalysisScope Resolve(
        string? selector,
        IReadOnlyList<PortfolioListItem> portfolios)
    {
        var normalized = string.IsNullOrWhiteSpace(selector) ? "all" : selector.Trim();
        if (normalized.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            return new("all", null, "All portfolios", true, false);
        }

        if (normalized.Equals("unassigned", StringComparison.OrdinalIgnoreCase))
        {
            return new("unassigned", null, "Unassigned", false, true);
        }

        PortfolioListItem? match = null;
        if (normalized.StartsWith("portfolio:", StringComparison.OrdinalIgnoreCase) &&
            Guid.TryParse(normalized["portfolio:".Length..], out var portfolioId))
        {
            match = portfolios.SingleOrDefault(item => item.Id == portfolioId);
        }
        else
        {
            var matches = portfolios
                .Where(item => item.Name.Equals(normalized, StringComparison.OrdinalIgnoreCase))
                .ToArray();
            if (matches.Length > 1)
            {
                var references = string.Join(", ", matches.Select(item => $"portfolio:{item.Id}"));
                throw new PortfolioAnalysisException(
                    "ambiguous_portfolio",
                    $"Portfolio name '{normalized}' is ambiguous. Use one of: {references}.");
            }

            match = matches.SingleOrDefault();
        }

        return match is null
            ? throw new PortfolioAnalysisException("portfolio_not_found", "The portfolio was not found for this user.")
            : new($"portfolio:{match.Id}", match.Id, match.Name, false, false);
    }
}
