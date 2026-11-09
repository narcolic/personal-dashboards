using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Energy;

public interface IEnergyStore
{
    Task<IReadOnlyList<EnergyBill>> ListAsync(Guid userId, CancellationToken ct);
    Task<EnergyBill?> SaveAsync(Guid userId, Guid? id, EnergyInput input, CancellationToken ct);
    Task<bool> DeleteAsync(Guid userId, Guid id, CancellationToken ct);
}

public sealed class EnergyStore(AppDataSource source) : IEnergyStore
{
    private const string Columns = "id,provider,supply_number,invoice_number,bill_type,period_start,period_end,billing_days,issue_date,due_date,kwh,supply_charges,regulated_charges,taxes,third_party_charges,adjustment,current_total,previous_balance,amount_due,fixed_charge,discount,document_hash,file_name,parser_version";

    public Task<IReadOnlyList<EnergyBill>> ListAsync(Guid userId, CancellationToken ct) =>
        source.ExecuteAsUserReadOnlyAsync<IReadOnlyList<EnergyBill>>(userId, async (c, tx, token) =>
        {
            await using var command = new NpgsqlCommand($"select {Columns} from public.energy_bills where user_id=$1 order by issue_date desc, id;", c, tx);
            command.Parameters.AddWithValue(userId);
            await using var reader = await command.ExecuteReaderAsync(token);
            var rows = new List<EnergyBill>();
            while (await reader.ReadAsync(token)) rows.Add(Read(reader));
            return rows;
        }, ct);

    public Task<EnergyBill?> SaveAsync(Guid userId, Guid? id, EnergyInput input, CancellationToken ct) =>
        source.ExecuteAsUserAsync<EnergyBill?>(userId, async (c, tx, token) =>
        {
            const string fields = "provider,supply_number,invoice_number,bill_type,period_start,period_end,billing_days,issue_date,due_date,kwh,supply_charges,regulated_charges,taxes,third_party_charges,adjustment,current_total,previous_balance,amount_due,fixed_charge,discount,document_hash,file_name,parser_version";
            var names = fields.Split(',');
            var sql = id.HasValue
                ? $"update public.energy_bills set {string.Join(",", names.Select((name, i) => $"{name}=${i + 3}"))} where user_id=$1 and id=$2 returning {Columns};"
                : $"insert into public.energy_bills(user_id,id,{fields}) values({string.Join(",", Enumerable.Range(1, 25).Select(i => $"${i}"))}) returning {Columns};";
            await using var command = new NpgsqlCommand(sql, c, tx);
            command.Parameters.AddWithValue(userId);
            command.Parameters.AddWithValue(id ?? Guid.NewGuid());
            command.Parameters.AddWithValue(input.Provider.Trim());
            command.Parameters.AddWithValue(input.SupplyNumber.Trim());
            Add(command, NpgsqlDbType.Text, Clean(input.InvoiceNumber));
            command.Parameters.AddWithValue(input.BillType);
            command.Parameters.AddWithValue(input.PeriodStart);
            command.Parameters.AddWithValue(input.PeriodEnd);
            command.Parameters.AddWithValue(input.BillingDays);
            command.Parameters.AddWithValue(input.IssueDate);
            Add(command, NpgsqlDbType.Date, input.DueDate);
            foreach (var value in new[] { input.Kwh, input.SupplyCharges, input.RegulatedCharges, input.Taxes,
                input.ThirdPartyCharges, input.Adjustment, input.CurrentTotal, input.PreviousBalance, input.AmountDue })
                command.Parameters.AddWithValue(value);
            Add(command, NpgsqlDbType.Numeric, input.FixedCharge);
            Add(command, NpgsqlDbType.Numeric, input.Discount);
            Add(command, NpgsqlDbType.Text, input.DocumentHash?.ToLowerInvariant());
            Add(command, NpgsqlDbType.Text, Clean(input.FileName));
            Add(command, NpgsqlDbType.Text, Clean(input.ParserVersion));
            await using var reader = await command.ExecuteReaderAsync(token);
            return await reader.ReadAsync(token) ? Read(reader) : null;
        }, ct);

    public Task<bool> DeleteAsync(Guid userId, Guid id, CancellationToken ct) =>
        source.ExecuteAsUserAsync(userId, async (c, tx, token) =>
        {
            await using var command = new NpgsqlCommand("delete from public.energy_bills where user_id=$1 and id=$2;", c, tx);
            command.Parameters.AddWithValue(userId);
            command.Parameters.AddWithValue(id);
            return await command.ExecuteNonQueryAsync(token) == 1;
        }, ct);

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static void Add(NpgsqlCommand command, NpgsqlDbType type, object? value) =>
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = type, Value = value ?? DBNull.Value });
    private static string? Text(NpgsqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetString(i);
    private static decimal? Amount(NpgsqlDataReader r, int i) => r.IsDBNull(i) ? null : r.GetDecimal(i);
    private static EnergyBill Read(NpgsqlDataReader r) => new(r.GetGuid(0), new EnergyInput(
        r.GetString(1), r.GetString(2), Text(r, 3), r.GetString(4),
        r.GetFieldValue<DateOnly>(5), r.GetFieldValue<DateOnly>(6), r.GetInt32(7),
        r.GetFieldValue<DateOnly>(8), r.IsDBNull(9) ? null : r.GetFieldValue<DateOnly>(9),
        r.GetDecimal(10), r.GetDecimal(11), r.GetDecimal(12), r.GetDecimal(13), r.GetDecimal(14),
        r.GetDecimal(15), r.GetDecimal(16), r.GetDecimal(17), r.GetDecimal(18),
        Amount(r, 19), Amount(r, 20), Text(r, 21), Text(r, 22), Text(r, 23)));
}
