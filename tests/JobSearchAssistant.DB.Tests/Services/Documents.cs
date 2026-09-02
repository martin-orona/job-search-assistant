using Dapper;

using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests.Services;

[Collection("SQLiteDatabase")]
public sealed class Documents_Service_Tests : SqliteTestBase
{
    public Documents_Service_Tests() : base("jobsearchassistant-documents-service-tests")
    {
    }

    [Fact]
    public async Task Documents_Create_ReturnsCreatedRecord()
    {
        RunMigrations();

        var created = await new Documents().Create(new Document
        {
            Title = "Service create test",
            Type = DocumentType.Markdown,
            Content = "Created via service",
            Source = "documents-service"
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created.Id);
        Assert.Equal("Service create test", created.Title);
        Assert.Equal(DocumentType.Markdown, created.Type);

        using var connection = Database.Connect();
        var storedType = await connection.QuerySingleAsync<string>(
            "select type from document where id = @Id",
            new { created.Id });
        Assert.Equal(nameof(DocumentType.Markdown), storedType);
    }

    [Fact]
    public async Task Documents_GetById_ReturnsMatchingDocument()
    {
        RunMigrations();

        var created = await new Documents().Create(new Document
        {
            Title = "Lookup title",
            Type = DocumentType.Text,
            Content = "Lookup content",
            Source = "lookup-source"
        });
        Assert.NotNull(created);

        var fetched = await new Documents().GetById(created.Id);

        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("Lookup title", fetched.Title);
        Assert.Equal("Lookup content", fetched.Content);
    }

    [Fact]
    public async Task Documents_Update_UpdatesRecordValues()
    {
        RunMigrations();

        var created = await new Documents().Create(new Document
        {
            Title = "Before update",
            Type = DocumentType.Text,
            Content = "Original content",
            Source = "before"
        });
        Assert.NotNull(created);

        var updated = await new Documents().FullUpdate(created.Id, new Document
        {
            Id = created.Id,
            Title = "After update",
            Type = DocumentType.Markdown,
            Content = "Updated content",
            Source = "after"
        });

        Assert.NotNull(updated);
        Assert.Equal(created.Id, updated!.Id);
        Assert.Equal("After update", updated.Title);
        Assert.Equal("Updated content", updated.Content);
        Assert.Equal("after", updated.Source);
    }

    [Fact]
    public async Task Documents_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var created = await new Documents().Create(new Document
        {
            Title = "Original title",
            Type = DocumentType.Text,
            Content = "Original content",
            Source = "source-1"
        });
        Assert.NotNull(created);

        var patched = await new Documents().PartialUpdate(created.Id, new Dictionary<string, object?>
        {
            ["content"] = "Patched content",
            ["source"] = "source-2"
        });

        Assert.NotNull(patched);
        Assert.Equal(created.Id, patched!.Id);
        Assert.Equal("Original title", patched.Title);
        Assert.Equal("Patched content", patched.Content);
        Assert.Equal("source-2", patched.Source);
    }

    [Fact]
    public async Task Documents_Delete_RemovesRecord()
    {
        RunMigrations();

        var created = await new Documents().Create(new Document
        {
            Title = "Delete me",
            Type = DocumentType.Other,
            Content = "Will be deleted",
            Source = "delete-source"
        });
        Assert.NotNull(created);

        var deleted = await new Documents().Delete(created.Id);

        Assert.NotNull(deleted);
        Assert.Equal(created.Id, deleted!.Id);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from document where id = @Id",
            new { Id = created.Id });

        Assert.Null(remaining);
    }
}
