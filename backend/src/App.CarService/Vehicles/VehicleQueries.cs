using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.CarService.Vehicles;

public sealed class VehicleQueries(AppDataSource dataSource) : IVehicleQueries
{
    public Task<VehicleListItem?> GetAsync(
        Guid userId,
        Guid vehicleId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            async (connection, transaction, token) =>
            {
                var vehicles = await ReadVehiclesAsync(
                    connection,
                    transaction,
                    userId,
                    vehicleId,
                    token).ConfigureAwait(false);
                return vehicles.SingleOrDefault();
            },
            cancellationToken);

    public Task<IReadOnlyList<VehicleListItem>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            (connection, transaction, token) =>
                ReadVehiclesAsync(connection, transaction, userId, null, token),
            cancellationToken);

    private static async Task<IReadOnlyList<VehicleListItem>> ReadVehiclesAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        Guid? vehicleId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id, user_id, name, make, model, plate, year, created_at, updated_at
            from public.vehicles
            where user_id = $1
              and ($2::uuid is null or id = $2)
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

        var vehicles = new List<VehicleListItem>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken)
            .ConfigureAwait(false);

        while (await reader.ReadAsync(cancellationToken).ConfigureAwait(false))
        {
            vehicles.Add(new VehicleListItem(
                reader.GetGuid(0),
                reader.GetGuid(1),
                reader.GetString(2),
                reader.IsDBNull(3) ? null : reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetInt32(6),
                new DateTimeOffset(reader.GetDateTime(7)),
                new DateTimeOffset(reader.GetDateTime(8))));
        }

        return vehicles;
    }
}
