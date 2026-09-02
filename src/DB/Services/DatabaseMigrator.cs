namespace JobSearchAssistant.DB;

using DbUp;

using System.Reflection;

public static class DatabaseMigrator
{
    public static void UpgradeDatabase(string connectionString)
    {
        Console.WriteLine("[Migration] Verifying schema via DbUp...");

        var upgrader = DeployChanges.To
            .SqliteDatabase(connectionString)
            .WithScriptsEmbeddedInAssembly(Assembly.GetExecutingAssembly())
            .LogToConsole()
            .Build();

        var result = upgrader.PerformUpgrade();

        if (!result.Successful)
        {
            throw new Exception("Database schema upgrade failed.", result.Error);
        }

        Console.WriteLine("[Migration] Database schema is up to date.\n");
    }
}
