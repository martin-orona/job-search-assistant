namespace JobSearchAssistant.Server;

using System;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Mvc;

using Dapper;

using JobSearchAssistant.DB;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

public class Admin
{
    public static RouteGroupBuilder Map(RouteGroupBuilder parent)
    {
        var group = parent.MapGroup("/admin");
        group.MapGet("/fix-db-enum-strings", (Delegate)FixDbEnumStrings);
        group.MapPost("/raw-sql", (Delegate)ExecuteRawSql);
        return group;
    }

    public static async Task<IResult> FixDbEnumStrings()
    {
        using var connection = Database.Connect();

        var docs = await connection.ExecuteAsync(
@"-- Convert values written by Dapper's default enum handling to their enum names.
update document
set type = case type
    when '0' then 'Unknown'
    when '1' then 'HTML'
    when '2' then 'PDF'
    when '3' then 'Markdown'
    when '4' then 'Text'
    when '5' then 'Word'
    when '6' then 'Other'
    else type
end
where type in ('0', '1', '2', '3', '4', '5', '6');"
            );

        var jboPostings = await connection.ExecuteAsync(
@"-- Convert values written by Dapper's default enum handling to their enum names.
update job_posting
set work_model = case work_model
    when '0' then 'Unknown'
    when '1' then 'Remote'
    when '2' then 'InOffice'
    when '3' then 'Hybrid'
    else work_model
end
where work_model in ('0', '1', '2', '3');"
            );

        var total = docs + jboPostings;
        return Results.Ok(total);
    }

    // Sample request: curl -X POST http://localhost:5000/api/v1/admin/raw-sql -H "Content-Type: application/json" -d '{ "sql": "update job_posting set work_model = ''3'' where id = 1" }'
    public static async Task<IResult> ExecuteRawSql([FromBody] RawSqlRequest request)
    {
        using var connection = Database.Connect();
        var result = await connection.ExecuteAsync(request.sql);
        return Results.Ok(result);
    }

    public record RawSqlRequest(string sql);
}
