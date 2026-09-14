namespace JobSearchAssistant.DB.Services;

using System.Reflection;

using JobSearchAssistant.Core;
using JobSearchAssistant.DB.Models;

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

    internal static string BuildSelectAll(string tableName, QueryOptions? options, bool deep = false, Type? modelType = null)
    {
        if (deep && modelType != null)
        {
            return BuildSelectDeep(tableName, modelType, byId: false);
        }

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

    internal static string BuildSelectById(string tableName, bool deep = false, Type? modelType = null)
    {
        if (deep && modelType != null)
        {
            return BuildSelectDeep(tableName, modelType, byId: true);
        }

        var sql = $"select * from {tableName.ToLower()} where id = @id order by id desc";
        return sql;
    }

    internal static string BuildSelectDeep(string tableName, Type modelType, bool byId)
    {
        var baseAlias = tableName.ToLower();
        var selectColumns = new List<string>();
        var joins = new List<string>();

        foreach (var scalar in GetScalarProperties(modelType))
        {
            var columnName = Formatting.PascalToSnakeCase(scalar.Name);
            selectColumns.Add($"{baseAlias}.{columnName} as {columnName}");
        }

        foreach (var modelProperty in GetDeepModelMetadata(modelType))
        {
            var nestedType = modelProperty.PropertyType;
            var nestedTableName = GetTableNameForType(nestedType);
            var nestedAlias = modelProperty.Alias;
            var foreignKeyColumn = Formatting.PascalToSnakeCase($"{modelProperty.Property.Name}Id");

            joins.Add($"left join {nestedTableName} {nestedAlias} on {nestedAlias}.id = {baseAlias}.{foreignKeyColumn}");

            foreach (var scalar in GetScalarProperties(nestedType))
            {
                if (scalar.Name.Equals(nameof(Model.Id), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (typeof(ModelWithDocument).IsAssignableFrom(nestedType)
                    && scalar.Name.Equals(nameof(ModelWithDocument.DocumentId), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var columnName = Formatting.PascalToSnakeCase(scalar.Name);
                selectColumns.Add($"{nestedAlias}.{columnName} as {nestedAlias}_{columnName}");
            }

            if (typeof(ModelWithDocument).IsAssignableFrom(nestedType) && nestedType != typeof(Document))
            {
                var documentAlias = $"{nestedAlias}_document";
                joins.Add($"left join document {documentAlias} on {documentAlias}.id = {nestedAlias}.document_id");

                foreach (var scalar in GetScalarProperties(typeof(Document)))
                {
                    var columnName = Formatting.PascalToSnakeCase(scalar.Name);
                    selectColumns.Add($"{documentAlias}.{columnName} as {documentAlias}_{columnName}");
                }
            }
        }

        var whereClause = byId ? $"where {baseAlias}.id = @id" : string.Empty;
        var sql = $@"select {string.Join(", ", selectColumns)}
                    from {tableName.ToLower()} {baseAlias}
                    {string.Join(" ", joins)}
                    {whereClause}
                    order by {baseAlias}.id desc";
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

    internal static IReadOnlyList<DeepModelMetadata> GetDeepModelMetadata(Type modelType)
    {
        return modelType
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => !CrudInfoGeneration.SystemFields.Contains(p.Name))
            .Where(p => typeof(Model).IsAssignableFrom(p.PropertyType))
            .Select(p => new DeepModelMetadata(p, p.PropertyType, Formatting.PascalToSnakeCase(p.Name)))
            .ToList()
            .AsReadOnly();
    }

    internal static IReadOnlyList<PropertyInfo> GetBaseScalarProperties(Type modelType)
    {
        return modelType
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => !typeof(Model).IsAssignableFrom(p.PropertyType))
            .ToList()
            .AsReadOnly();
    }

    private static IReadOnlyList<PropertyInfo> GetScalarProperties(Type modelType)
    {
        return modelType
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => !typeof(Model).IsAssignableFrom(p.PropertyType))
            .ToList()
            .AsReadOnly();
    }

    private static IReadOnlyList<PropertyInfo> GetModelProperties(Type modelType)
    {
        return modelType
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(p => !CrudInfoGeneration.SystemFields.Contains(p.Name))
            .Where(p => typeof(Model).IsAssignableFrom(p.PropertyType))
            .ToList()
            .AsReadOnly();
    }

    private static string GetTableNameForType(Type modelType)
    {
        if (modelType == typeof(Document))
        {
            return "document";
        }

        if (CrudInfoGeneration.CrudInfo.ContainsKey(modelType))
        {
            return CrudInfoGeneration.CrudInfo[modelType].TableName;
        }

        return Formatting.PascalToSnakeCase(modelType.Name);
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

public record DeepModelMetadata(PropertyInfo Property, Type PropertyType, string Alias);

public record JoinDefinition
{
    required public string Table { get; init; }

    required public string Alias { get; init; }

    required public string OnCondition { get; init; }

    public JoinType Type { get; init; } = JoinType.Inner;
}
