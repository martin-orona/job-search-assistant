using System.Text;
using System.Text.Json;

using JobSearchAssistant.DB;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;

namespace JobSearchAssistant.TestUtilities;

public abstract class SqliteTestBase : IDisposable
{
    protected static readonly object DbSetupLock = new();

    protected readonly string TempFolder;
    protected readonly string TempCloudFolder;
    protected readonly string TempLocalFolder;
    protected readonly string OriginalCloudFolder;
    protected readonly string OriginalLocalFolder;

    protected SqliteTestBase(string testName)
    {
        TempFolder = Path.Combine(Path.GetTempPath(), $"{testName}-{Guid.NewGuid():N}");
        TempCloudFolder = Path.Combine(TempFolder, "cloud");
        TempLocalFolder = Path.Combine(TempFolder, "local");

        Directory.CreateDirectory(TempFolder);
        Directory.CreateDirectory(TempCloudFolder);
        Directory.CreateDirectory(TempLocalFolder);

        OriginalCloudFolder = FileLifecycleManager.CloudFolder;
        OriginalLocalFolder = FileLifecycleManager.LocalFolder;

        FileLifecycleManager.CloudFolder = TempCloudFolder;
        FileLifecycleManager.LocalFolder = TempLocalFolder;
    }

    protected void RunMigrations()
    {
        lock (DbSetupLock)
        {
            Database.Startup(TempCloudFolder, TempLocalFolder);
            Database.RunMigrations();
        }
    }

    protected static DefaultHttpContext CreateContext()
    {
        var context = new DefaultHttpContext();
        var services = new ServiceCollection();
        services.AddRouting();
        services.AddLogging();
        services.AddOptions<JsonOptions>();
        context.RequestServices = services.BuildServiceProvider();
        context.Response.Body = new MemoryStream();
        return context;
    }

    protected static DefaultHttpContext CreateJsonHttpContext<T>(T request)
    {
        var content = JsonSerializer.Serialize(request);
        var context = CreateContext();
        context.Request.ContentType = "application/json";
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(content));
        context.Request.ContentLength = context.Request.Body.Length;
        return context;
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();

        FileLifecycleManager.CloudFolder = OriginalCloudFolder;
        FileLifecycleManager.LocalFolder = OriginalLocalFolder;

        if (Directory.Exists(TempFolder))
        {
            Directory.Delete(TempFolder, recursive: true);
        }
    }
}