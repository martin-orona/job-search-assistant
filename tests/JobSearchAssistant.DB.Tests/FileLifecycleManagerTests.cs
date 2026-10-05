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

    [Fact]
    public void CreateDailyBackupSnapshot_WithTestFlow_PreservesCloudAndOtherFlowBackups()
    {
        var cloudBackup = Path.Combine(FileLifecycleManager.CloudFolder, "JobSearchAssistant.db.2024-09-14T08-00-00Z");
        File.WriteAllText(cloudBackup, "real backup");
        var timestamp = new DateTime(2024, 9, 14, 10, 15, 0, DateTimeKind.Utc);
        try
        {
            FileLifecycleManager.SetTestDatabase("snapshot-first");
            File.WriteAllText(FileLifecycleManager.LocalDbPath, "first flow");
            var firstBackup = FileLifecycleManager.CreateDailyBackupSnapshot(timestamp);
            Assert.StartsWith(FileLifecycleManager.GetTestDatabaseFolder("snapshot-first"), firstBackup);
            Assert.Single(FileLifecycleManager.GetDailyBackupSnapshots());

            FileLifecycleManager.SetTestDatabase("snapshot-second");
            File.WriteAllText(FileLifecycleManager.LocalDbPath, "second flow");
            Assert.Empty(FileLifecycleManager.GetDailyBackupSnapshots());
            var secondBackup = FileLifecycleManager.CreateDailyBackupSnapshot(timestamp);
            Assert.NotEqual(firstBackup, secondBackup);
            Assert.Equal("first flow", File.ReadAllText(firstBackup));
            Assert.Equal("real backup", File.ReadAllText(cloudBackup));

            FileLifecycleManager.DeleteTestDatabase("snapshot-second");
            Assert.False(File.Exists(secondBackup));
            Assert.True(File.Exists(firstBackup));
        }
        finally
        {
            FileLifecycleManager.ClearTestDatabase();
        }
        Assert.Equal([Path.GetFileName(cloudBackup)], FileLifecycleManager.GetDailyBackupSnapshots());
    }
}
