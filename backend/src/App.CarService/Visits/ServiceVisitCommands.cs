using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.CarService.Visits;

public sealed class ServiceVisitCommands(AppDataSource dataSource) : IServiceVisitCommands
{
    public Task<MutationResult> CreateAsync(
        Guid userId,
        ServiceVisitMutation mutation,
        CancellationToken cancellationToken = default) =>
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

                await using var command = CreateVisitCommand(
                    connection,
                    transaction,
                    userId,
                    null,
                    mutation);
                var visitId = (Guid)(await command.ExecuteScalarAsync(token)
                    .ConfigureAwait(false))!;
                await InsertJobsAsync(
                    connection,
                    transaction,
                    visitId,
                    mutation.Jobs,
                    token).ConfigureAwait(false);
                return MutationResult.Succeeded(visitId);
            },
            cancellationToken);

    public Task<MutationResult> UpdateAsync(
        Guid userId,
        Guid visitId,
        ServiceVisitMutation mutation,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                if (!await OwnsVisitAsync(
                        connection,
                        transaction,
                        userId,
                        visitId,
                        token).ConfigureAwait(false))
                {
                    return MutationResult.Missing("Service visit not found.");
                }

                if (!await OwnsVehicleAsync(
                        connection,
                        transaction,
                        userId,
                        mutation.VehicleId,
                        token).ConfigureAwait(false))
                {
                    return MutationResult.Missing("Vehicle not found.");
                }

                await using (var command = CreateVisitCommand(
                    connection,
                    transaction,
                    userId,
                    visitId,
                    mutation))
                {
                    await command.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                }

                await using (var deleteJobs = connection.CreateCommand())
                {
                    deleteJobs.Transaction = transaction;
                    deleteJobs.CommandText = """
                        delete from public.service_jobs
                        where service_visit_id = $1;
                        """;
                    AddUuid(deleteJobs, visitId);
                    await deleteJobs.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                }

                await InsertJobsAsync(
                    connection,
                    transaction,
                    visitId,
                    mutation.Jobs,
                    token).ConfigureAwait(false);
                return MutationResult.Succeeded(visitId);
            },
            cancellationToken);

    public Task<MutationResult> DeleteAsync(
        Guid userId,
        Guid visitId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                await using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = """
                    delete from public.service_visits
                    where id = $1 and user_id = $2
                    returning id;
                    """;
                AddUuid(command, visitId);
                AddUuid(command, userId);
                var deleted = await command.ExecuteScalarAsync(token).ConfigureAwait(false);
                return deleted is Guid
                    ? MutationResult.Succeeded()
                    : MutationResult.Missing("Service visit not found.");
            },
            cancellationToken);

    private static NpgsqlCommand CreateVisitCommand(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid? visitId,
        ServiceVisitMutation mutation)
    {
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = visitId.HasValue
            ? """
                update public.service_visits
                set vehicle_id = $3, service_date = $4, odometer_km = $5,
                    workshop = $6, notes = $7, vat_rate = $8,
                    is_annual_service = $9
                where id = $1 and user_id = $2
                returning id;
                """
            : """
                insert into public.service_visits (
                    user_id, vehicle_id, service_date, odometer_km,
                    workshop, notes, vat_rate, is_annual_service)
                values ($2, $3, $4, $5, $6, $7, $8, $9)
                returning id;
                """;
        AddUuid(command, visitId ?? Guid.Empty);
        AddUuid(command, userId);
        AddUuid(command, mutation.VehicleId);
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Date, Value = mutation.ServiceDate });
        command.Parameters.AddWithValue(mutation.OdometerKm);
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = (object?)TrimToNull(mutation.Workshop) ?? DBNull.Value });
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = (object?)TrimToNull(mutation.Notes) ?? DBNull.Value });
        command.Parameters.AddWithValue(mutation.VatRate);
        command.Parameters.AddWithValue(mutation.IsAnnualService);
        return command;
    }

    private static async Task InsertJobsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid visitId,
        IReadOnlyList<ServiceJobMutation> jobs,
        CancellationToken cancellationToken)
    {
        foreach (var job in jobs)
        {
            await using var command = connection.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = """
                insert into public.service_jobs (
                    service_visit_id, job_catalog_id, job_name_snapshot,
                    category_snapshot, quantity, unit_price_ex_vat,
                    line_total_ex_vat, notes, is_custom)
                values ($1, null, $2, $3, $4, $5, $6, $7, true);
                """;
            AddUuid(command, visitId);
            command.Parameters.AddWithValue(job.JobName.Trim());
            command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = (object?)TrimToNull(job.Category) ?? DBNull.Value });
            command.Parameters.AddWithValue(job.Quantity);
            command.Parameters.AddWithValue(job.UnitPriceExVat);
            command.Parameters.AddWithValue(decimal.Round(
                job.UnitPriceExVat * job.Quantity,
                2,
                MidpointRounding.AwayFromZero));
            command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = (object?)TrimToNull(job.Notes) ?? DBNull.Value });
            await command.ExecuteNonQueryAsync(cancellationToken).ConfigureAwait(false);
        }
    }

    private static Task<bool> OwnsVehicleAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid vehicleId,
        CancellationToken cancellationToken) =>
        ExistsAsync(
            connection,
            transaction,
            "select exists(select 1 from public.vehicles where id = $1 and user_id = $2);",
            vehicleId,
            userId,
            cancellationToken);

    private static Task<bool> OwnsVisitAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid visitId,
        CancellationToken cancellationToken) =>
        LockOwnedVisitAsync(
            connection,
            transaction,
            visitId,
            userId,
            cancellationToken);

    private static async Task<bool> LockOwnedVisitAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid visitId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id from public.service_visits
            where id = $1 and user_id = $2
            for update;
            """;
        AddUuid(command, visitId);
        AddUuid(command, userId);
        return await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false) is Guid;
    }

    private static async Task<bool> ExistsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string sql,
        Guid id,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        AddUuid(command, id);
        AddUuid(command, userId);
        return (bool)(await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false))!;
    }

    private static string? TrimToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void AddUuid(NpgsqlCommand command, Guid value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = value,
        });
}
