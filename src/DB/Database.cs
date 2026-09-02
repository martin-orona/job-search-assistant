namespace JobSearchAssistant.DB;

using Dapper;

using JobSearchAssistant.Core;
using JobSearchAssistant.DB.Mappings;
using JobSearchAssistant.DB.Models;

using Microsoft.Data.Sqlite;

public class Database
{
    public static void Startup(string? cloudFolder, string? localFolder)
    {
        Services.CRUD.RegisterCrudServices();

        SqlMapper.AddTypeHandler(new DateTimeOffsetTypeHandler());
        SqlMapper.AddTypeHandler(new EnumTypeHandler<DocumentType>());
        SqlMapper.AddTypeHandler(new EnumTypeHandler<WorkModel>());
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        FileLifecycleManager.SyncFromCloud(cloudFolder, localFolder);
    }

    public static void Startup(AppSettings settings)
    {
        if (settings == null)
        {
            throw new ArgumentNullException(nameof(settings));
        }

        if (settings.Storage == null)
        {
            throw new InvalidOperationException("Storage settings are not configured.");
        }

        if (string.IsNullOrEmpty(settings.Storage.CloudFolder))
        {
            throw new InvalidOperationException("Storage:CloudFolder is not configured.");
        }

        if (string.IsNullOrEmpty(settings.Storage.LocalFolder))
        {
            throw new InvalidOperationException("Storage:LocalFolder is not configured.");
        }

        Startup(settings.Storage.CloudFolder, settings.Storage.LocalFolder);
    }

    public static void RunMigrations() => DatabaseMigrator.UpgradeDatabase(FileLifecycleManager.ConnectionString);

    public static void Shutdown() => FileLifecycleManager.SyncToCloud();

    public static SqliteConnection Connect()
    {
        var connection = new SqliteConnection(FileLifecycleManager.ConnectionString);
        connection.Open();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = ON;";
            command.ExecuteNonQuery();
        }

        return connection;
    }
}
