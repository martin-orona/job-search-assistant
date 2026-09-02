namespace JobSearchAssistant.DB.Mappings;

using Dapper;

using System.Data;

public sealed class EnumTypeHandler<TEnum> : SqlMapper.TypeHandler<TEnum>
    where TEnum : struct, Enum
{
    public override void SetValue(IDbDataParameter parameter, TEnum value) =>
        parameter.Value = value.ToString();

    public override TEnum Parse(object value)
    {
        if (value is string text)
        {
            return Enum.Parse<TEnum>(text, ignoreCase: true);
        }

        return (TEnum)Enum.ToObject(typeof(TEnum), Convert.ToInt32(value));
    }
}
