using Npgsql;
using NpgsqlTypes;
using PortfolioTerminal.Data;

namespace PortfolioTerminal.Travel;

public sealed record TravelInput(string Name, string Country, double? Latitude, double? Longitude,
    DateOnly? VisitDate, string? Note);
public sealed record TravelPlace(Guid Id, string Name, string Country, double Latitude, double Longitude,
    DateOnly? VisitDate, string? Note);

public interface ITravelStore
{
    Task<IReadOnlyList<TravelPlace>> ListAsync(Guid userId, CancellationToken ct);
    Task<TravelPlace?> SaveAsync(Guid userId, Guid? id, TravelInput input, CancellationToken ct);
    Task<bool> DeleteAsync(Guid userId, Guid id, CancellationToken ct);
}

public sealed class TravelStore(AppDataSource source) : ITravelStore
{
    public Task<IReadOnlyList<TravelPlace>> ListAsync(Guid userId, CancellationToken ct) =>
        source.ExecuteAsUserReadOnlyAsync<IReadOnlyList<TravelPlace>>(userId, async (connection, transaction, token) =>
        {
            await using var command = new NpgsqlCommand("""
                select id, name, country, latitude, longitude, visit_date, note
                from public.travel_places where user_id=$1
                order by visit_date desc nulls last, created_at desc, id;
                """, connection, transaction);
            command.Parameters.AddWithValue(userId);
            await using var reader = await command.ExecuteReaderAsync(token);
            var places = new List<TravelPlace>();
            while (await reader.ReadAsync(token)) places.Add(Read(reader));
            return places;
        }, ct);

    public Task<TravelPlace?> SaveAsync(Guid userId, Guid? id, TravelInput input, CancellationToken ct) =>
        source.ExecuteAsUserAsync<TravelPlace?>(userId, async (connection, transaction, token) =>
        {
            await using var command = new NpgsqlCommand(id.HasValue ? """
                update public.travel_places set name=$3, country=$4, latitude=$5, longitude=$6,
                  visit_date=$7, note=$8 where user_id=$1 and id=$2
                returning id, name, country, latitude, longitude, visit_date, note;
                """ : """
                insert into public.travel_places(user_id,id,name,country,latitude,longitude,visit_date,note)
                values($1,$2,$3,$4,$5,$6,$7,$8)
                returning id, name, country, latitude, longitude, visit_date, note;
                """, connection, transaction);
            command.Parameters.AddWithValue(userId);
            command.Parameters.AddWithValue(id ?? Guid.NewGuid());
            command.Parameters.AddWithValue(input.Name.Trim());
            command.Parameters.AddWithValue(input.Country.Trim());
            command.Parameters.AddWithValue(input.Latitude!.Value);
            command.Parameters.AddWithValue(input.Longitude!.Value);
            command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Date, Value = (object?)input.VisitDate ?? DBNull.Value });
            command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Text, Value = string.IsNullOrWhiteSpace(input.Note) ? DBNull.Value : input.Note.Trim() });
            await using var reader = await command.ExecuteReaderAsync(token);
            return await reader.ReadAsync(token) ? Read(reader) : null;
        }, ct);

    public Task<bool> DeleteAsync(Guid userId, Guid id, CancellationToken ct) =>
        source.ExecuteAsUserAsync(userId, async (connection, transaction, token) =>
        {
            await using var command = new NpgsqlCommand(
                "delete from public.travel_places where user_id=$1 and id=$2;", connection, transaction);
            command.Parameters.AddWithValue(userId);
            command.Parameters.AddWithValue(id);
            return await command.ExecuteNonQueryAsync(token) == 1;
        }, ct);

    private static TravelPlace Read(NpgsqlDataReader reader) => new(reader.GetGuid(0), reader.GetString(1),
        reader.GetString(2), reader.GetDouble(3), reader.GetDouble(4),
        reader.IsDBNull(5) ? null : reader.GetFieldValue<DateOnly>(5), reader.IsDBNull(6) ? null : reader.GetString(6));
}
