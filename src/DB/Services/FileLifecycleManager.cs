namespace JobSearchAssistant.DB;

public static class FileLifecycleManager
{
    private const string DbFileName = "JobSearchAssistant.db";

    private static readonly string DefaultCloudFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        @"OneDrive\Documents\Marscelkai\JobSearchAssistant"
    );

    private static readonly string DefaultLocalFolder = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        @"Marscelkai\JobSearchAssistant"
    );

    public static string CloudFolder { get; set; } = DefaultCloudFolder;

    public static string LocalFolder { get; set; } = DefaultLocalFolder;

    public static string LocalDbPath => Path.Combine(LocalFolder, DbFileName);

    internal static string ConnectionString => $"Data Source={LocalDbPath};";

    private static string CloudDbPath => Path.Combine(CloudFolder, DbFileName);

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

    public static void SyncToCloud()
    {
        if (!File.Exists(LocalDbPath))
        {
            return;
        }

        try
        {
            Console.WriteLine("[Sync] Application exiting. Safely pushing database snapshot to OneDrive...");
            Directory.CreateDirectory(CloudFolder);
            File.Copy(LocalDbPath, CloudDbPath, overwrite: true);
            Console.WriteLine("[Sync] OneDrive backup successful.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[Warning] OneDrive sync delayed: {ex.Message}. File will sync next runtime.");
        }
    }
}
