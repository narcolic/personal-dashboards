using System.Text.Json;
using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.CarService.Vehicles;

public sealed class VehicleCommands(AppDataSource dataSource) : IVehicleCommands
{
    public async Task<MutationResult> CreateAsync(
        Guid userId,
        VehicleMutation mutation,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await dataSource.ExecuteAsUserAsync(
                userId,
                async (connection, transaction, token) =>
                {
                    await using var command = CreateUpsertCommand(
                        connection,
                        transaction,
                        userId,
                        null,
                        mutation);
                    var id = (Guid)(await command.ExecuteScalarAsync(token).ConfigureAwait(false))!;
                    return MutationResult.Succeeded(id);
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (PostgresException exception)
            when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return MutationResult.Conflicted(
                "A vehicle with this license plate already exists.");
        }
    }

    public async Task<MutationResult> UpdateAsync(
        Guid userId,
        Guid vehicleId,
        VehicleMutation mutation,
        CancellationToken cancellationToken = default)
    {
        try
        {
            return await dataSource.ExecuteAsUserAsync(
                userId,
                async (connection, transaction, token) =>
                {
                    await using var command = CreateUpsertCommand(
                        connection,
                        transaction,
                        userId,
                        vehicleId,
                        mutation);
                    var value = await command.ExecuteScalarAsync(token).ConfigureAwait(false);
                    return value is Guid id
                        ? MutationResult.Succeeded(id)
                        : MutationResult.Missing("Vehicle not found.");
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (PostgresException exception)
            when (exception.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            return MutationResult.Conflicted(
                "A vehicle with this license plate already exists.");
        }
    }

    public Task<MutationResult> DeleteAsync(
        Guid userId,
        Guid vehicleId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                await using (var lockCommand = connection.CreateCommand())
                {
                    lockCommand.Transaction = transaction;
                    lockCommand.CommandText = """
                        select id
                        from public.vehicles
                        where id = $1 and user_id = $2
                        for update;
                        """;
                    AddUuid(lockCommand, vehicleId);
                    AddUuid(lockCommand, userId);
                    if (await lockCommand.ExecuteScalarAsync(token).ConfigureAwait(false) is null)
                    {
                        return MutationResult.Missing("Vehicle not found.");
                    }
                }

                await using (var countCommand = connection.CreateCommand())
                {
                    countCommand.Transaction = transaction;
                    countCommand.CommandText = """
                        select count(*)
                        from public.service_visits
                        where vehicle_id = $1 and user_id = $2;
                        """;
                    AddUuid(countCommand, vehicleId);
                    AddUuid(countCommand, userId);
                    var count = (long)(await countCommand.ExecuteScalarAsync(token)
                        .ConfigureAwait(false))!;
                    if (count > 0)
                    {
                        return MutationResult.Conflicted(
                            $"CANNOT DELETE - {count} SERVICE VISITS LINKED");
                    }
                }

                await using var deleteCommand = connection.CreateCommand();
                deleteCommand.Transaction = transaction;
                deleteCommand.CommandText = """
                    delete from public.vehicles
                    where id = $1 and user_id = $2;
                    """;
                AddUuid(deleteCommand, vehicleId);
                AddUuid(deleteCommand, userId);
                await deleteCommand.ExecuteNonQueryAsync(token).ConfigureAwait(false);
                return MutationResult.Succeeded();
            },
            cancellationToken);

    private static NpgsqlCommand CreateUpsertCommand(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid? vehicleId,
        VehicleMutation mutation)
    {
        var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = vehicleId.HasValue
            ? """
                update public.vehicles
                set name = $3, make = $4, model = $5, year = $6, plate = $7
                where id = $1 and user_id = $2
                returning id;
                """
            : """
                insert into public.vehicles (user_id, name, make, model, year, plate)
                values ($2, $3, $4, $5, $6, $7)
                returning id;
                """;
        AddUuid(command, vehicleId ?? Guid.Empty);
        AddUuid(command, userId);
        command.Parameters.AddWithValue(SerializeName(mutation));
        command.Parameters.AddWithValue(mutation.Make.Trim());
        command.Parameters.AddWithValue(mutation.Model.Trim());
        command.Parameters.AddWithValue(mutation.Year);
        command.Parameters.AddWithValue(mutation.Plate.Trim());
        return command;
    }

    private static string SerializeName(VehicleMutation mutation)
    {
        var metadata = new
        {
            colour = mutation.Colour?.Trim() ?? string.Empty,
            notes = mutation.Notes?.Trim() ?? string.Empty,
            annualServiceIntervalKm = mutation.AnnualServiceIntervalKm,
            annualServiceIntervalMonths = mutation.AnnualServiceIntervalMonths,
        };
        return $"{mutation.Make.Trim()} {mutation.Model.Trim()}||{JsonSerializer.Serialize(metadata)}";
    }

    private static void AddUuid(NpgsqlCommand command, Guid value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = value,
        });
}
