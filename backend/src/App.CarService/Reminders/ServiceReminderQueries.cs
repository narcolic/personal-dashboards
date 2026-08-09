using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.CarService.Reminders;

public sealed class ServiceReminderQueries(AppDataSource dataSource) : IServiceReminderQueries
{
    public Task<IReadOnlyList<ServiceReminderListItem>> ListAsync(
        Guid userId,
        Guid? vehicleId,
        bool activeOnly,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            (connection, transaction, token) =>
                ReadRemindersAsync(
                    connection,
                    transaction,
                    userId,
                    vehicleId,
                    activeOnly,
                    token),
            cancellationToken);

    private static async Task<IReadOnlyList<ServiceReminderListItem>> ReadRemindersAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid? vehicleId,
        bool activeOnly,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id, user_id, vehicle_id, job_name, interval_km,
                   interval_months, warning_km, warning_days, notes,
                   is_active, created_at
            from public.service_reminders
            where user_id = $1
              and ($2::uuid is null or vehicle_id = $2)
              and (not $3 or is_active)
            order by created_at, id;
            """;
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = userId,
        });
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = (object?)vehicleId ?? DBNull.Value,
        });
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Boolean,
            Value = activeOnly,
        });

        var reminders = new List<ServiceReminderListItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);

        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            reminders.Add(new ServiceReminderListItem(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetGuid(2),
                reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetInt32(4),
                reader.IsDBNull(5) ? null : reader.GetInt32(5),
                reader.IsDBNull(6) ? null : reader.GetInt32(6),
                reader.IsDBNull(7) ? null : reader.GetInt32(7),
                reader.IsDBNull(8) ? null : reader.GetString(8),
                reader.GetBoolean(9),
                new DateTimeOffset(reader.GetDateTime(10))));
        }

        return reminders;
    }
}
