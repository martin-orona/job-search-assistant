namespace JobSearchAssistant.DB.Tests;

//public class SqliteConfig
//{
[Collection("SQLiteDatabase")]
public sealed class SqliteConfig : SqliteTestBase
{
    public SqliteConfig() : base("jobsearchassistant-db-config-tests")
    {
    }

    [Fact]
    public void Connect_enables_sqlite_foreign_keys()
    {
        RunMigrations();

        using var connection = JobSearchAssistant.DB.Database.Connect();
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA foreign_keys;";

        var result = command.ExecuteScalar();

        Assert.Equal(1L, (long)result!);
    }
}
