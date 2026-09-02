using Dapper;

using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests;

[Collection("SQLiteDatabase")]
public sealed class Document_table_Tests : SqliteTestBase
{
    public Document_table_Tests() : base("jobsearchassistant-tests")
    {
    }

    [Fact]
    public void RunMigrations_CreatesExpectedTables()
    {
        RunMigrations();

        using var connection = Database.Connect();

        var tableCount = connection.QuerySingle<int>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('document');");

        Assert.Equal(1, tableCount);
    }

    [Fact]
    public async Task Documents_CreateAndGetById_RoundTripsData()
    {
        RunMigrations();

        var created = await new Documents().Create(new Document
        {
            Title = "Senior C# Developer",
            Type = DocumentType.Markdown,
            Content = "This is a sample document for SQLite testing.",
            Source = "unit-test"
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created.Id);
        Assert.Equal("Senior C# Developer", created.Title);

        var fetched = await new Documents().GetById(created.Id);

        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("This is a sample document for SQLite testing.", fetched.Content);
    }

    [Fact]
    public async Task Updating_document_updates_updatedat_via_trigger()
    {
        RunMigrations();

        var created = await new Documents().Create(new Document
        {
            Title = "Initial title",
            Type = DocumentType.Text,
            Content = "Initial content",
            Source = "test"
        });

        Assert.NotNull(created);

        using var connection = Database.Connect();
        var originalUpdatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from document where id = @Id",
            new { created.Id });

        await Task.Delay(1100);

        await connection.ExecuteAsync(
            "update document set title = @Title where id = @Id",
            new { Title = "Updated title", created.Id });

        var updatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from document where id = @Id",
            new { created.Id });

        Assert.True(updatedAt > originalUpdatedAt,
            $"Expected updated_at to change after update. Original: {originalUpdatedAt:o}, Updated: {updatedAt:o}");
    }

    [Fact]
    public async Task Document_fts_index_is_created_and_searches_document_fields()
    {
        RunMigrations();

        await new Documents().Create(new Document
        {
            Title = "Senior C# Developer",
            Type = DocumentType.Markdown,
            Content = "Responsible for building resilient backend services with SQLite and C#.",
            Source = "https://example.com/jobs/123"
        });

        using var connection = Database.Connect();

        var titleMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from document_fts_index where title match 'developer' ");

        var contentMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from document_fts_index where content match 'sqlite' ");

        var sourceMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from document_fts_index where source match 'example' ");

        Assert.Equal(1, titleMatches);
        Assert.Equal(1, contentMatches);
        Assert.Equal(1, sourceMatches);
    }

    [Fact]
    public async Task Document_fts_index_updates_when_document_content_changes()
    {
        RunMigrations();

        var created = await new Documents().Create(new Document
        {
            Title = "Initial role",
            Type = DocumentType.Text,
            Content = "Python automation engineer",
            Source = "legacy-source"
        });
        Assert.NotNull(created);

        using var connection = Database.Connect();

        var initialMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from document_fts_index where content match 'python' ");

        Assert.Equal(1, initialMatches);

        await new Documents().FullUpdate(created.Id, new Document
        {
            Id = created.Id,
            Title = "Updated role",
            Type = DocumentType.Text,
            Content = "C# cloud engineer with Azure",
            Source = "new-source"
        });

        var oldTermStillMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from document_fts_index where content match 'python' ");

        var newTermMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from document_fts_index where content match 'azure' ");

        Assert.Equal(0, oldTermStillMatches);
        Assert.Equal(1, newTermMatches);
    }
}
