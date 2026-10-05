namespace JobSearchAssistant.DB.Mappings;

using System.Data;
using System.Text;
using System.Text.Json;

using Dapper;

public sealed class JsonListTypeHandler<T> : SqlMapper.TypeHandler<List<T>>
{
    public override void SetValue(IDbDataParameter parameter, List<T>? value)
    {
        var json = JsonSerializer.Serialize(value ?? new List<T>());
        parameter.Value = Encoding.UTF8.GetBytes(json);
    }

    public override List<T> Parse(object value)
    {
        if (value is byte[] bytes)
        {
            var json = Encoding.UTF8.GetString(bytes);
            return JsonSerializer.Deserialize<List<T>>(json) ?? new List<T>();
        }

        if (value is string text)
        {
            return JsonSerializer.Deserialize<List<T>>(text) ?? new List<T>();
        }

        throw new NotSupportedException($"Unsupported JSON list value type '{value.GetType().Name}' for '{typeof(T).Name}'.");
    }
}
