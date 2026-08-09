using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.CarService.Visits;

public sealed class ServiceVisitQueries(AppDataSource dataSource) : IServiceVisitQueries
{
    public Task<ServiceVisitListItem?> GetAsync(
        Guid userId,
        Guid visitId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            (connection, transaction, token) =>
                ReadVisitAsync(connection, transaction, userId, visitId, token),
            cancellationToken);

    public Task<IReadOnlyList<ServiceVisitListItem>> ListAsync(
        Guid userId,
        Guid? vehicleId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            (connection, transaction, token) =>
                ReadVisitsAsync(connection, transaction, userId, vehicleId, token),
            cancellationToken);

    private static async Task<IReadOnlyList<ServiceVisitListItem>> ReadVisitsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid? vehicleId,
        CancellationToken cancellationToken)
    {
        await using var batch = new NpgsqlBatch(connection, transaction);
        batch.BatchCommands.Add(CreateVisitsCommand(userId, vehicleId));
        batch.BatchCommands.Add(CreateJobsCommand(userId, vehicleId));

        var visits = new List<ServiceVisitListItem>();
        var jobsByVisit = new Dictionary<Guid, List<ServiceJobListItem>>();

        await using var reader = await batch.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);

        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            var visitId = reader.GetGuid(0);
            var jobs = new List<ServiceJobListItem>();
            jobsByVisit.Add(visitId, jobs);
            visits.Add(ReadVisit(reader, jobs));
        }

        await reader.NextResultAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            var visitId = reader.GetGuid(1);
            if (!jobsByVisit.TryGetValue(visitId, out var jobs))
            {
                continue;
            }

            jobs.Add(ReadJob(reader));
        }

        return visits;
    }

    private static async Task<ServiceVisitListItem?> ReadVisitAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid visitId,
        CancellationToken cancellationToken)
    {
        await using var batch = new NpgsqlBatch(connection, transaction);
        batch.BatchCommands.Add(CreateVisitCommand(userId, visitId));
        batch.BatchCommands.Add(CreateVisitJobsCommand(userId, visitId));

        ServiceVisitListItem? visit = null;
        var jobs = new List<ServiceJobListItem>();

        await using var reader = await batch.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);

        if (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            visit = ReadVisit(reader, jobs);
        }

        await reader.NextResultAsync(cancellationToken).ConfigureAwait(false);
        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            jobs.Add(ReadJob(reader));
        }

        return visit;
    }

    private static ServiceVisitListItem ReadVisit(
        NpgsqlDataReader reader,
        IReadOnlyList<ServiceJobListItem> jobs) =>
        new(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.GetGuid(2),
            reader.GetFieldValue<DateOnly>(3),
            reader.GetInt32(4),
            reader.IsDBNull(5) ? null : reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetString(6),
            reader.GetDecimal(7),
            reader.GetDecimal(8),
            reader.GetDecimal(9),
            reader.GetDecimal(10),
            new DateTimeOffset(reader.GetDateTime(11)),
            new DateTimeOffset(reader.GetDateTime(12)),
            reader.GetBoolean(13),
            jobs);

    private static ServiceJobListItem ReadJob(NpgsqlDataReader reader) =>
        new(
            reader.GetGuid(0),
            reader.GetGuid(1),
            reader.IsDBNull(2) ? null : reader.GetGuid(2),
            reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetString(4),
            reader.GetDecimal(5),
            reader.GetDecimal(6),
            reader.GetDecimal(7),
            reader.IsDBNull(8) ? null : reader.GetString(8),
            reader.GetBoolean(9),
            new DateTimeOffset(reader.GetDateTime(10)),
            new DateTimeOffset(reader.GetDateTime(11)));

    private static NpgsqlBatchCommand CreateVisitCommand(Guid userId, Guid visitId)
    {
        var command = new NpgsqlBatchCommand("""
            select id, vehicle_id, user_id, service_date, odometer_km, workshop,
                   notes, vat_rate, subtotal_ex_vat, vat_amount, total_amount,
                   created_at, updated_at, is_annual_service
            from public.service_visits
            where user_id = $1 and id = $2;
            """);
        AddParameters(command, userId, visitId);
        return command;
    }

    private static NpgsqlBatchCommand CreateVisitJobsCommand(Guid userId, Guid visitId)
    {
        var command = new NpgsqlBatchCommand("""
            select sj.id, sj.service_visit_id, sj.job_catalog_id,
                   sj.job_name_snapshot, sj.category_snapshot, sj.quantity,
                   sj.unit_price_ex_vat, sj.line_total_ex_vat, sj.notes,
                   sj.is_custom, sj.created_at, sj.updated_at
            from public.service_jobs sj
            inner join public.service_visits sv on sv.id = sj.service_visit_id
            where sv.user_id = $1 and sv.id = $2
            order by sj.created_at, sj.id;
            """);
        AddParameters(command, userId, visitId);
        return command;
    }

    private static NpgsqlBatchCommand CreateVisitsCommand(Guid userId, Guid? vehicleId)
    {
        var command = new NpgsqlBatchCommand("""
            select id, vehicle_id, user_id, service_date, odometer_km, workshop,
                   notes, vat_rate, subtotal_ex_vat, vat_amount, total_amount,
                   created_at, updated_at, is_annual_service
            from public.service_visits
            where user_id = $1
              and ($2::uuid is null or vehicle_id = $2)
            order by service_date desc, id;
            """);
        AddParameters(command, userId, vehicleId);
        return command;
    }

    private static NpgsqlBatchCommand CreateJobsCommand(Guid userId, Guid? vehicleId)
    {
        var command = new NpgsqlBatchCommand("""
            select sj.id, sj.service_visit_id, sj.job_catalog_id,
                   sj.job_name_snapshot, sj.category_snapshot, sj.quantity,
                   sj.unit_price_ex_vat, sj.line_total_ex_vat, sj.notes,
                   sj.is_custom, sj.created_at, sj.updated_at
            from public.service_jobs sj
            inner join public.service_visits sv on sv.id = sj.service_visit_id
            where sv.user_id = $1
              and ($2::uuid is null or sv.vehicle_id = $2)
            order by sj.created_at, sj.id;
            """);
        AddParameters(command, userId, vehicleId);
        return command;
    }

    private static void AddParameters(
        NpgsqlBatchCommand command,
        Guid userId,
        Guid? vehicleId)
    {
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
    }
}
