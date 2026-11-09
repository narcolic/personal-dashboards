namespace PortfolioTerminal.Energy;

public sealed record EnergyInput(
    string Provider, string SupplyNumber, string? InvoiceNumber, string BillType,
    DateOnly PeriodStart, DateOnly PeriodEnd, int BillingDays, DateOnly IssueDate, DateOnly? DueDate,
    decimal Kwh, decimal SupplyCharges, decimal RegulatedCharges, decimal Taxes,
    decimal ThirdPartyCharges, decimal Adjustment, decimal CurrentTotal, decimal PreviousBalance,
    decimal AmountDue, decimal? FixedCharge, decimal? Discount, string? DocumentHash,
    string? FileName, string? ParserVersion);

public sealed record EnergyBill(Guid Id, EnergyInput Summary);

public static class EnergyValidation
{
    public static Dictionary<string, string[]> Validate(EnergyInput input)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(input.Provider) || input.Provider.Trim().Length > 100)
            errors["provider"] = ["Provider must be between 1 and 100 characters."];
        if (string.IsNullOrWhiteSpace(input.SupplyNumber) || input.SupplyNumber.Trim().Length > 100)
            errors["supplyNumber"] = ["Supply identifier must be between 1 and 100 characters."];
        if (input.InvoiceNumber?.Trim().Length > 100) errors["invoiceNumber"] = ["Invoice number is too long."];
        if (input.BillType is not ("actual" or "estimated")) errors["billType"] = ["Choose actual or estimated."];
        if (input.PeriodStart.Year < 1900 || input.PeriodEnd < input.PeriodStart ||
            input.PeriodEnd.DayNumber - input.PeriodStart.DayNumber > 732 || input.PeriodEnd.Year > 2200)
            errors["period"] = ["Enter a valid consumption period of at most two years."];
        if (input.IssueDate.Year is < 1900 or > 2200 || input.IssueDate < input.PeriodEnd)
            errors["issueDate"] = ["Issue date must be on or after the consumption period."];
        if (input.DueDate is { } due && (due < input.IssueDate || due.Year > 2200))
            errors["dueDate"] = ["Due date must be on or after issue date."];
        if (input.BillingDays is < 1 or > 733) errors["billingDays"] = ["Billing days must be between 1 and 733."];
        if (input.Kwh is < 0 or > 10000000 || decimal.Round(input.Kwh, 3) != input.Kwh)
            errors["kwh"] = ["Consumption must be a nonnegative number with at most three decimal places."];
        decimal?[] amounts = [input.SupplyCharges, input.RegulatedCharges, input.Taxes,
            input.ThirdPartyCharges, input.Adjustment, input.CurrentTotal, input.PreviousBalance,
            input.AmountDue, input.FixedCharge, input.Discount];
        if (amounts.Any(x => x is { } value && (value is < -1000000 or > 1000000 || decimal.Round(value, 2) != value)))
            errors["amounts"] = ["Amounts must be within one million EUR and have at most two decimal places."];
        if (input.FixedCharge is < 0 || input.Discount is > 0)
            errors["details"] = ["Fixed charge cannot be negative; discount must be zero or negative."];
        if (!errors.ContainsKey("amounts") && input.SupplyCharges + input.RegulatedCharges + input.Taxes + input.ThirdPartyCharges + input.Adjustment != input.CurrentTotal)
            errors["currentTotal"] = ["Charge breakdown must equal the current-period total."];
        if (!errors.ContainsKey("amounts") && input.CurrentTotal + input.PreviousBalance != input.AmountDue)
            errors["amountDue"] = ["Current total plus previous balance must equal amount due."];
        if (input.DocumentHash is { } hash && (hash.Length != 64 || !hash.All(Uri.IsHexDigit)))
            errors["documentHash"] = ["Document hash must be a SHA-256 hexadecimal digest."];
        if (input.FileName?.Length > 255 || input.ParserVersion?.Length > 60)
            errors["source"] = ["Source metadata is too long."];
        return errors;
    }
}
