namespace JobSearchAssistant.DB.Services;

public class QueryBuilder
{
    internal static string BuildDelete(string tableName)
    {
        var sql = $@"delete from {tableName.ToLower()}
                    where id = @id
                    returning *";
        return sql;
    }

    internal static string BuildInsert(string tableName, IReadOnlyList<string> insertFieldList, IReadOnlyList<string> insertValueList)
    {
        var sql = $@"insert into {tableName} ( {string.Join(", ", insertFieldList)} )
                    values ({string.Join(", ", insertValueList)})
                    returning *";
        return sql;
    }

    internal static string BuildSelectAll(string tableName, QueryOptions? options)
    {
        var tail = GetOptionsSql(options);
        var defaultOrderBy = options?.OrderBy?.Length > 0 ? string.Empty : $"order by id desc";
        var sql = $"select * from {tableName.ToLower()} {tail} {defaultOrderBy}";
        return sql;
    }

    internal static string BuildSelectAllWithJoins(string baseTable, string baseAlias, IReadOnlyList<JoinDefinition> joins, QueryOptions? options)
    {
        var selectColumns = string.Join(", ", new[] { $"{baseAlias}.*" }.Concat(joins.Select(j => $"{j.Alias}.*")));
        var baseJoinTable = $"{baseTable.ToLower()} {baseAlias}";
        var additionalJoinTables = string.Join(" ", joins.Select(j => $"{(j.Type == JoinType.Left ? "left" : "inner")} join {j.Table} {j.Alias} on {j.OnCondition}"));
        var tail = GetOptionsSql(options);

        // Only fall back to the default sort when the caller didn't already specify one
        var defaultOrderBy = options?.OrderBy?.Length > 0 ? string.Empty : $"order by {baseAlias}.id desc";
        var sql = $@"select {selectColumns} 
                    from {baseJoinTable} 
                    {additionalJoinTables} 
                    {tail} 
                    {defaultOrderBy}";
        return sql;
    }

    // Terse alternative to the JoinDefinition overload for simple (table, alias, onCondition) inner joins
    internal static string BuildSelectAllWithJoins((string Table, string Alias) baseTable, IReadOnlyList<(string Table, string Alias, string OnCondition)> joins, QueryOptions? options) =>
        BuildSelectAllWithJoins(baseTable.Table, baseTable.Alias, joins.Select(j => new JoinDefinition { Table = j.Table, Alias = j.Alias, OnCondition = j.OnCondition }).ToList(), options);

    internal static string BuildSelectById(string tableName)
    {
        var sql = $"select * from {tableName.ToLower()} where id = @id order by id desc";
        return sql;
    }

    internal static string BuildUpdate(string tableName, IReadOnlyList<string> propertySetList)
    {
        var sql = $@"update {tableName}
                    set {string.Join(", ", propertySetList)}
                    where id = @Id
                    returning *";
        return sql;
    }

    private static string GetOptionsSql(QueryOptions? options)
    {
        if (options == null)
        {
            return string.Empty;
        }

        var sqlParts = new List<string>();

        if (options.OrderBy?.Length > 0)
        {
            var orderBySegments = options.OrderBy.Select(o => $"{o.Column} {(o.Ascending ? "asc" : "desc")}");
            sqlParts.Add($"order by {string.Join(", ", orderBySegments)}");
        }

        if (options.Limit.HasValue)
        {
            sqlParts.Add($"limit {options.Limit.Value}");
        }

        if (options.Offset.HasValue)
        {
            sqlParts.Add($"offset {options.Offset.Value}");
        }

        return string.Join(" ", sqlParts);
    }
}

public record QueryOptions
{
    public QueryOrderBy[]? OrderBy { get; init; }

    public int? Limit { get; init; }
    public int? Offset { get; init; }
}

public record QueryOrderBy
{
    public string Column { get; init; } = string.Empty;
    public bool Ascending { get; init; } = true;
}

public enum JoinType
{
    /// <summary>A normal inner join.</summary>
    Inner,

    /// <summary>A left outer join.</summary>
    Left,
}

public record JoinDefinition
{
    required public string Table { get; init; }

    required public string Alias { get; init; }

    required public string OnCondition { get; init; }

    public JoinType Type { get; init; } = JoinType.Inner;
}
