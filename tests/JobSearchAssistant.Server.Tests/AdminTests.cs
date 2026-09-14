using JobSearchAssistant.DB;

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

        global::JobSearchAssistant.Server.Admin.Map(app.MapGroup("/api/v1"), app);

        var endpoints = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(dataSource => dataSource.Endpoints)
            .OfType<RouteEndpoint>()
            .Select(endpoint => endpoint.RoutePattern.RawText);

        Assert.Contains("/api/v1/admin/fix-db-enum-strings", endpoints);
        Assert.Contains("/api/v1/admin/raw-sql", endpoints);
        Assert.Contains("/api/v1/admin/db-snapshot", endpoints);
        Assert.Contains("/api/v1/admin/db-backups", endpoints);
    }

    [Fact]
    public async Task Admin_CreateDailyBackupRoute_ReturnsCurrentDailyBackups()
    {
        var tempFolder = Path.Combine(Path.GetTempPath(), $"jsa-admin-backups-{Guid.NewGuid():N}");
        var cloudFolder = Path.Combine(tempFolder, "cloud");
        var localFolder = Path.Combine(tempFolder, "local");
        Directory.CreateDirectory(cloudFolder);
        Directory.CreateDirectory(localFolder);

        var originalCloudFolder = FileLifecycleManager.CloudFolder;
        var originalLocalFolder = FileLifecycleManager.LocalFolder;
        FileLifecycleManager.CloudFolder = cloudFolder;
        FileLifecycleManager.LocalFolder = localFolder;

        try
        {
            var localDbPath = FileLifecycleManager.LocalDbPath;
            Directory.CreateDirectory(Path.GetDirectoryName(localDbPath)!);
            File.WriteAllText(localDbPath, "database contents");

            var result = await global::JobSearchAssistant.Server.Admin.CreateDailyBackupSnapshot();
            var context = CreateContext();
            await result.ExecuteAsync(context);

            Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
            Assert.NotEmpty(FileLifecycleManager.GetDailyBackupSnapshots());
        }
        finally
        {
            FileLifecycleManager.CloudFolder = originalCloudFolder;
            FileLifecycleManager.LocalFolder = originalLocalFolder;
            if (Directory.Exists(tempFolder))
            {
                Directory.Delete(tempFolder, recursive: true);
            }
        }
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