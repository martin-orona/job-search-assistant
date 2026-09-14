namespace JobSearchAssistant.DB;

using System.Collections.Concurrent;
using System.Globalization;

using Microsoft.Data.Sqlite;

public static class FileLifecycleManager
{
    private const string DbFileName = "JobSearchAssistant.db";
    public const string TestDatabasePrefix = "jsa_test_";
    private const int MaxTestFlowIdLength = 80;
    private static readonly ConcurrentDictionary<string, HashSet<SqliteConnection>> ActiveConnectionsByDatabase = new(StringComparer.OrdinalIgnoreCase);

    private static readonly string DefaultCloudFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        @"OneDrive\Documents\Marscelkai\JobSearchAssistant"
    );

    private static readonly string DefaultLocalFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        @"Marscelkai\JobSearchAssistant"
    );

    private static string? ActiveTestFlowId { get; set; }

    public static string CloudFolder { get; set; } = DefaultCloudFolder;

    public static string LocalFolder { get; set; } = DefaultLocalFolder;

    public static string LocalDbPath => string.IsNullOrWhiteSpace(ActiveTestFlowId)
        ? Path.Combine(LocalFolder, DbFileName)
        : Path.Combine(GetTestDatabaseFolder(ActiveTestFlowId), DbFileName);

    private static string LocalTestDbFolder => Path.Combine(LocalFolder, "TestDatabases");

    internal static string ConnectionString => $"Data Source={LocalDbPath};";

    private static string CloudDbPath => Path.Combine(CloudFolder, DbFileName);

    public static string GetTestDatabaseFolder(string flowId)
    {
        var safeId = SanitizeTestFlowId(flowId);
        return Path.Combine(LocalTestDbFolder, $"{TestDatabasePrefix}{safeId}");
    }

    public static void SetTestDatabase(string flowId)
    {
        var safeId = SanitizeTestFlowId(flowId);
        if (string.IsNullOrEmpty(safeId))
        {
            ActiveTestFlowId = null;
            return;
        }

        ActiveTestFlowId = safeId;
        Directory.CreateDirectory(GetTestDatabaseFolder(safeId));
    }

    public static void ClearTestDatabase()
    {
        ActiveTestFlowId = null;
    }

    public static void TrackConnection(SqliteConnection connection)
    {
        ArgumentNullException.ThrowIfNull(connection);

        var databasePath = GetNormalizedDatabasePath(connection.DataSource);
        if (string.IsNullOrWhiteSpace(databasePath))
        {
            return;
        }

        var connections = ActiveConnectionsByDatabase.GetOrAdd(databasePath, _ => new HashSet<SqliteConnection>());
        lock (connections)
        {
            connections.Add(connection);
        }
    }

    public static void ReleaseConnection(SqliteConnection connection)
    {
        ArgumentNullException.ThrowIfNull(connection);

        var databasePath = GetNormalizedDatabasePath(connection.DataSource);
        if (string.IsNullOrWhiteSpace(databasePath))
        {
            return;
        }

        if (!ActiveConnectionsByDatabase.TryGetValue(databasePath, out var connections))
        {
            return;
        }

        lock (connections)
        {
            connections.Remove(connection);
        }

        if (connections.Count == 0)
        {
            ActiveConnectionsByDatabase.TryRemove(databasePath, out _);
        }
    }

    public static void DeleteTestDatabase(string flowId)
    {
        var safeId = SanitizeTestFlowId(flowId);
        if (string.IsNullOrEmpty(safeId))
        {
            return;
        }

        var folder = GetTestDatabaseFolder(safeId);
        var databasePath = Path.Combine(folder, DbFileName);
        CloseConnectionsForDatabase(databasePath);
        DeleteFolderWithRetry(folder);

        if (ActiveTestFlowId == safeId)
        {
            ActiveTestFlowId = null;
        }
    }

    public static void CleanupStaleTestDatabases()
    {
        if (!Directory.Exists(LocalTestDbFolder))
        {
            return;
        }

        foreach (var directory in Directory.EnumerateDirectories(LocalTestDbFolder))
        {
            var folderName = Path.GetFileName(directory)
                ?? string.Empty;
            if (folderName.StartsWith(TestDatabasePrefix, StringComparison.OrdinalIgnoreCase))
            {
                DeleteFolderWithRetry(directory);
            }
        }
    }

    public static void SyncFromCloud(string? cloudFolder, string? localFolder)
    {
        CloudFolder = cloudFolder ?? DefaultCloudFolder;
        LocalFolder = localFolder ?? DefaultLocalFolder;

        Directory.CreateDirectory(LocalFolder);
        Directory.CreateDirectory(CloudFolder);

        if (File.Exists(CloudDbPath))
        {
            var isLocalDbExists = File.Exists(LocalDbPath);
            var isCloudDbNewer = File.GetLastWriteTimeUtc(CloudDbPath) > File.GetLastWriteTimeUtc(LocalDbPath);

            if (!isLocalDbExists || isCloudDbNewer)
            {
                Console.WriteLine("[Sync] Cloud database is newer or local copy missing. Pulling down...");
                File.Copy(CloudDbPath, LocalDbPath, overwrite: true);
            }
        }
    }

    public static string CreateDailyBackupSnapshot(DateTime? timestampUtc = null)
    {
        if (!File.Exists(LocalDbPath))
        {
            throw new FileNotFoundException("The database has not been created locally yet.", LocalDbPath);
        }

        Directory.CreateDirectory(CloudFolder);

        var snapshotTime = timestampUtc ?? DateTime.UtcNow;
        var snapshotName = $"{DbFileName}.{snapshotTime:yyyy-MM-ddTHH-mm-ssZ}";
        var snapshotPath = Path.Combine(CloudFolder, snapshotName);
        var backupPrefix = DbFileName + ".";

        foreach (var existingBackup in Directory.EnumerateFiles(CloudFolder, "*.*", SearchOption.TopDirectoryOnly))
        {
            var existingName = Path.GetFileName(existingBackup);
            if (string.IsNullOrWhiteSpace(existingName) || !existingName.StartsWith(backupPrefix, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var datePortion = existingName[backupPrefix.Length..];
            if (!DateTime.TryParseExact(datePortion, "yyyy-MM-ddTHH-mm-ssZ", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var existingTimestamp))
            {
                continue;
            }

            if (existingTimestamp.Date == snapshotTime.Date)
            {
                if (string.Equals(existingBackup, snapshotPath, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                // Delete any existing backup for the same day to keep only the latest one being created
                File.Delete(existingBackup);
            }
        }

        File.Copy(LocalDbPath, snapshotPath, overwrite: true);
        return snapshotPath;
    }

    public static List<string> GetDailyBackupSnapshots()
    {
        if (!Directory.Exists(CloudFolder))
        {
            return [];
        }

        return Directory.EnumerateFiles(CloudFolder, "JobSearchAssistant.db.*", SearchOption.TopDirectoryOnly)
            .Select(file => Path.GetFileName(file) ?? file)
            .OrderByDescending(name => name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public static void SyncToCloud()
    {
        if (!string.IsNullOrWhiteSpace(ActiveTestFlowId))
        {
            Console.WriteLine("[Sync] Skipping cloud sync for active disposable test database.");
            return;
        }

        if (!File.Exists(LocalDbPath))
        {
            return;
        }

        try
        {
            Console.WriteLine("[Sync] Application exiting. Safely pushing database snapshot to OneDrive...");
            Directory.CreateDirectory(CloudFolder);
            File.Copy(LocalDbPath, CloudDbPath, overwrite: true);
            CreateDailyBackupSnapshot();
            Console.WriteLine("[Sync] OneDrive backup successful.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Warning] OneDrive sync delayed: {ex.Message}. File will sync next runtime.");
        }
    }

    private static void DeleteFolderWithRetry(string folder)
    {
        if (!Directory.Exists(folder))
        {
            return;
        }

        for (var attempt = 0; attempt < 5; attempt++)
        {
            try
            {
                SqliteConnection.ClearAllPools();

                foreach (var file in Directory.EnumerateFiles(folder, "*.*", SearchOption.AllDirectories))
                {
                    try
                    {
                        File.Delete(file);
                    }
                    catch (IOException)
                    {
                        throw;
                    }
                }

                Directory.Delete(folder, recursive: true);
                return;
            }
            catch (IOException)
            {
                if (attempt == 4)
                {
                    throw;
                }

                Thread.Sleep(100 * (attempt + 1));
            }
            catch (UnauthorizedAccessException)
            {
                if (attempt == 4)
                {
                    throw;
                }

                Thread.Sleep(100 * (attempt + 1));
            }
        }
    }

    private static void CloseConnectionsForDatabase(string databasePath)
    {
        var normalizedPath = GetNormalizedDatabasePath(databasePath);
        if (string.IsNullOrWhiteSpace(normalizedPath))
        {
            return;
        }

        if (!ActiveConnectionsByDatabase.TryGetValue(normalizedPath, out var connections))
        {
            return;
        }

        var trackedConnections = new List<SqliteConnection>();
        lock (connections)
        {
            trackedConnections.AddRange(connections);
            connections.Clear();
        }

        foreach (var connection in trackedConnections)
        {
            try
            {
                if (connection.State != System.Data.ConnectionState.Closed)
                {
                    connection.Close();
                }
            }
            catch
            {
                // Best effort: the database is being torn down. Closing a stale connection is the goal.
            }
            finally
            {
                try
                {
                    connection.Dispose();
                }
                catch
                {
                    // Best effort: ensure the delete path continues even when a stale connection is already disposed.
                }
            }
        }

        ActiveConnectionsByDatabase.TryRemove(normalizedPath, out _);
    }

    private static string? GetNormalizedDatabasePath(string? databasePath)
    {
        if (string.IsNullOrWhiteSpace(databasePath))
        {
            return null;
        }

        return Path.GetFullPath(databasePath).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
    }

    private static string SanitizeTestFlowId(string flowId)
    {
        var sanitized = new string(flowId.Where(ch => char.IsLetterOrDigit(ch) || ch == '-' || ch == '_').ToArray());
        sanitized = sanitized.Trim();

        if (string.IsNullOrWhiteSpace(sanitized))
        {
            return string.Empty;
        }

        if (sanitized.Length <= MaxTestFlowIdLength)
        {
            return sanitized;
        }

        return sanitized[..MaxTestFlowIdLength];
    }
}
