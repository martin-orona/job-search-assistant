namespace JobSearchAssistant.DB.Tests;

public sealed class FileLifecycleManagerTests : SqliteTestBase
{
    public FileLifecycleManagerTests() : base("jobsearchassistant-file-lifecycle-tests")
    {
    }

    [Fact]
    public void SyncFromCloud_CopiesCloudDatabaseToLocal_WhenCloudDatabaseIsNewer()
    {
        var cloudDbPath = Path.Combine(FileLifecycleManager.CloudFolder, "JobSearchAssistant.db");
        var localDbPath = FileLifecycleManager.LocalDbPath;

        Directory.CreateDirectory(Path.GetDirectoryName(localDbPath)!);

        File.WriteAllText(cloudDbPath, "cloud database contents");
        File.WriteAllText(localDbPath, "stale local database contents");

        var cloudTime = new DateTime(2024, 9, 14, 12, 0, 0, DateTimeKind.Utc);
        var localTime = new DateTime(2024, 9, 14, 11, 0, 0, DateTimeKind.Utc);

        File.SetLastWriteTimeUtc(cloudDbPath, cloudTime);
        File.SetLastWriteTimeUtc(localDbPath, localTime);

        FileLifecycleManager.SyncFromCloud(FileLifecycleManager.CloudFolder, FileLifecycleManager.LocalFolder);

        Assert.Equal("cloud database contents", File.ReadAllText(localDbPath));
    }

    [Fact]
    public void SyncToCloud_CopiesLocalDatabaseAndCreatesDailySnapshot()
    {
        var cloudDbPath = Path.Combine(FileLifecycleManager.CloudFolder, "JobSearchAssistant.db");
        var localDbPath = FileLifecycleManager.LocalDbPath;

        Directory.CreateDirectory(Path.GetDirectoryName(localDbPath)!);
        File.WriteAllText(localDbPath, "database contents");

        FileLifecycleManager.SyncToCloud();

        Assert.True(File.Exists(cloudDbPath));
        Assert.Equal("database contents", File.ReadAllText(cloudDbPath));

        var snapshots = FileLifecycleManager.GetDailyBackupSnapshots();
        Assert.NotEmpty(snapshots);
        Assert.All(snapshots, snapshot => Assert.StartsWith("JobSearchAssistant.db.", snapshot));
    }

    [Fact]
    public void CreateDailyBackupSnapshot_CreatesTimestampedCopy_AndKeepsLatestForThatDay()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(FileLifecycleManager.LocalDbPath)!);
        File.WriteAllText(FileLifecycleManager.LocalDbPath, "database contents");

        var olderSameDayBackup = Path.Combine(FileLifecycleManager.CloudFolder, "JobSearchAssistant.db.2024-09-14T08-00-00Z");
        var newerSameDayBackup = Path.Combine(FileLifecycleManager.CloudFolder, "JobSearchAssistant.db.2024-09-14T09-00-00Z");
        var previousDayBackup = Path.Combine(FileLifecycleManager.CloudFolder, "JobSearchAssistant.db.2024-09-13T09-00-00Z");

        File.WriteAllText(olderSameDayBackup, "older");
        File.WriteAllText(newerSameDayBackup, "newer");
        File.WriteAllText(previousDayBackup, "previous day");

        var expectedBackupPath = Path.Combine(FileLifecycleManager.CloudFolder, "JobSearchAssistant.db.2024-09-14T10-15-00Z");

        var backupPath = FileLifecycleManager.CreateDailyBackupSnapshot(new DateTime(2024, 9, 14, 10, 15, 0, DateTimeKind.Utc));

        Assert.Equal(expectedBackupPath, backupPath);
        Assert.True(File.Exists(expectedBackupPath));
        Assert.False(File.Exists(olderSameDayBackup));
        Assert.False(File.Exists(newerSameDayBackup));
        Assert.True(File.Exists(previousDayBackup));
    }
}
