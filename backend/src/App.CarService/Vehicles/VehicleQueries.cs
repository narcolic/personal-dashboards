using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.CarService.Vehicles;

public sealed class VehicleQueries(AppDataSource dataSource) : IVehicleQueries
{
    public Task<IReadOnlyList<VehicleListItem>> ListAsync(
        Guid userId,
        CancellationToken cancellationToken = default) =>
        dataSource.ExecuteAsUserAsync(
            userId,
            (connection, transaction, token) =>
                ReadVehiclesAsync(connection, transaction, userId, token),
            cancellationToken);

    private static async Task<IReadOnlyList<VehicleListItem>> ReadVehiclesAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            select id, user_id, name, make, model, plate, year, created_at, updated_at
            from public.vehicles
            where user_id = $1
            order by created_at, id;
            """;
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Uuid,
            Value = userId,
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
