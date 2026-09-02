using Microsoft.Data.Sqlite;

namespace JobSearchAssistant.DB.Tests;

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
