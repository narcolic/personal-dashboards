using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.CarService.Reminders;

public sealed class ServiceReminderCommands(AppDataSource dataSource) : IServiceReminderCommands
{
    public Task<MutationResult> CreateAsync(
        Guid userId,
        ServiceReminderMutation mutation,
        CancellationToken cancellationToken = default) =>
        ExecuteUpsertAsync(userId, null, mutation, cancellationToken);

    public Task<MutationResult> UpdateAsync(
        Guid userId,
        Guid reminderId,
        ServiceReminderMutation mutation,
        CancellationToken cancellationToken = default) =>
        ExecuteUpsertAsync(userId, reminderId, mutation, cancellationToken);

    public Task<MutationResult> DeleteAsync(
        Guid userId,
        Guid reminderId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = """
                    delete from public.service_reminders
                    where id = $1 and user_id = $2
                    returning id;
                    """;
                AddUuid(command, reminderId);
                AddUuid(command, userId);
                return await command.ExecuteScalarAsync(token).ConfigureAwait(false) is Guid
                    ? MutationResult.Succeeded()
                    : MutationResult.Missing("Service reminder not found.");
            },
            cancellationToken);

    private Task<MutationResult> ExecuteUpsertAsync(
        Guid userId,
        Guid? reminderId,
        ServiceReminderMutation mutation,
        CancellationToken cancellationToken) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                if (!await OwnsVehicleAsync(
                        connection,
                        transaction,
                        userId,
                        mutation.VehicleId,
                        token).ConfigureAwait(false))
                {
                    return MutationResult.Missing("Vehicle not found.");
                }

                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = reminderId.HasValue
                    ? """
                        update public.service_reminders
                        set vehicle_id = $3, job_name = $4, interval_km = $5,
                            interval_months = $6, warning_km = $7,
                            warning_days = $8, notes = $9, is_active = $10
                        where id = $1 and user_id = $2
                        returning id;
                        """
                    : """
                        insert into public.service_reminders (
                            user_id, vehicle_id, job_name, interval_km,
                            interval_months, warning_km, warning_days, notes, is_active)
                        values ($2, $3, $4, $5, $6, $7, $8, $9, $10)
                        returning id;
                        """;
                AddUuid(command, reminderId ?? Guid.Empty);
                AddUuid(command, userId);
                AddUuid(command, mutation.VehicleId);
                command.Parameters.AddWithValue(mutation.JobName.Trim());
                AddNullableInteger(command, mutation.IntervalKm);
                AddNullableInteger(command, mutation.IntervalMonths);
                AddNullableInteger(command, mutation.WarningKm);
                AddNullableInteger(command, mutation.WarningDays);
                command.Parameters.Add(new NpgsqlParameter
                {
                    NpgsqlDbType = NpgsqlDbType.Text,
                    Value = string.IsNullOrWhiteSpace(mutation.Notes)
                        ? DBNull.Value
                        : mutation.Notes.Trim(),
                });
                command.Parameters.AddWithValue(mutation.IsActive);

                var result = await command.ExecuteScalarAsync(token).ConfigureAwait(false);
                return result is Guid id
                    ? MutationResult.Succeeded(id)
                    : MutationResult.Missing("Service reminder not found.");
            },
            cancellationToken);

    private static async Task<bool> OwnsVehicleAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid vehicleId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select exists(
                select 1 from public.vehicles where id = $1 and user_id = $2
            );
            """;
        AddUuid(command, vehicleId);
        AddUuid(command, userId);
        return (bool)(await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false))!;
    }

    private static void AddNullableInteger(NpgsqlCommand command, int? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Integer,
            Value = (object?)value ?? DBNull.Value,
        });

    private static void AddUuid(NpgsqlCommand command, Guid value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = value,
        });
}
