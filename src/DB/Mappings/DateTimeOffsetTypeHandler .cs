namespace JobSearchAssistant.DB.Mappings;

using Dapper;

using System.Data;

public class DateTimeOffsetTypeHandler : SqlMapper.TypeHandler<DateTimeOffset>
{
    public override void SetValue(IDbDataParameter parameter, DateTimeOffset value) => parameter.Value = value.ToString("o");

    public override DateTimeOffset Parse(object value)
    {
        if (value is string str)
        {
            return DateTimeOffset.Parse(str);
        }

        // Handle cases where the database might return a DateTime or DateTimeOffset directly
        if (value is DateTimeOffset dto)
        {
            return dto;
        }

        if (value is DateTime dt)
        {
            return new DateTimeOffset(dt);
        }

        return Convert.ToDateTime(value);
    }
}
