using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace JobSearchAssistant.Server.Tests;

[Collection("SQLiteDatabase")]
public sealed class AdminTests : SqliteTestBase
{
    public AdminTests() : base("jobsearchassistant-server-admin-tests")
    {
    }

    [Fact]
    public void Map_RegistersAdminRoutes()
    {
        var builder = WebApplication.CreateBuilder();
        using var app = builder.Build();

        global::JobSearchAssistant.Server.Admin.Map(app.MapGroup("/api/v1"));

        var endpoints = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(dataSource => dataSource.Endpoints)
            .OfType<RouteEndpoint>()
            .Select(endpoint => endpoint.RoutePattern.RawText);

        Assert.Contains("/api/v1/admin/fix-db-enum-strings", endpoints);
        Assert.Contains("/api/v1/admin/raw-sql", endpoints);
    }

    [Fact]
    public async Task Admin_ExecuteRawSqlRoute_ReturnsOkResult()
    {
        RunMigrations();

        var request = new global::JobSearchAssistant.Server.Admin.RawSqlRequest("update document set title = 'raw-sql route test' where 1 = 1");

        var result = await global::JobSearchAssistant.Server.Admin.ExecuteRawSql(request);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }

}