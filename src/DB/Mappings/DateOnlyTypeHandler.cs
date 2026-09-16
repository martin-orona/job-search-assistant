namespace JobSearchAssistant.DB.Mappings;

using System.Data;

using Dapper;

public sealed class DateOnlyTypeHandler : SqlMapper.TypeHandler<DateOnly>
{
    public override void SetValue(IDbDataParameter parameter, DateOnly value)
    {
        parameter.Value = value.ToString("yyyy-MM-dd");
    }

    public override DateOnly Parse(object value)
    {
        if (value is DateOnly dateOnly)
        {
            return dateOnly;
        }

        if (value is DateTime dateTime)
        {
            return DateOnly.FromDateTime(dateTime);
        }

        return DateOnly.Parse(value.ToString() ?? string.Empty);
    }
}
