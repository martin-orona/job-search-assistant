using Dapper;

namespace JobSearchAssistant.DB.Tests;

[Collection("SQLiteDatabase")]
public sealed class ai_prompt_template_Tests : SqliteTestBase
{
    public ai_prompt_template_Tests() : base("jobsearchassistant-ai-prompt-template-tests")
    {
    }

    [Fact]
    public void RunMigrations_CreatesExpectedTables()
    {
        RunMigrations();

        using var connection = Database.Connect();

        var tableCount = connection.QuerySingle<int>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'ai_prompt_template';");

        Assert.Equal(1, tableCount);
    }

    [Fact]
    public async Task AiPromptTemplate_CreateAndGetById_RoundTripsData()
    {
        RunMigrations();

        using var connection = Database.Connect();

        var documentId = await connection.QuerySingleAsync<int>(
            @"insert into document (title, type, content, source)
              values (@Title, @Type, @Content, @Source)
              returning id",
            new
            {
                Title = "Resume summary template",
                Type = "Markdown",
                Content = "Summarize the candidate profile for a technical hiring manager.",
                Source = "migration-tests"
            });

        var insertedId = await connection.QuerySingleAsync<int>(
            @"insert into ai_prompt_template (name, document_id)
              values (@Name, @DocumentId)
              returning id",
            new
            {
                Name = "resume-summary",
                DocumentId = documentId
            });

        var row = await connection.QuerySingleAsync<dynamic>(
            "select name, document_id from ai_prompt_template where id = @Id",
            new { Id = insertedId });

        var documentRow = await connection.QuerySingleAsync<dynamic>(
            "select content from document where id = @Id",
            new { Id = documentId });

        Assert.Equal("resume-summary", (string)row.name);
        Assert.Equal(documentId, (long)row.document_id);
        Assert.Equal("Summarize the candidate profile for a technical hiring manager.", (string)documentRow.content);
    }

    [Fact]
    public async Task Updating_ai_prompt_template_updates_updatedat_via_trigger()
    {
        RunMigrations();

        using var connection = Database.Connect();

        var documentId = await connection.QuerySingleAsync<int>(
            @"insert into document (title, type, content, source)
              values (@Title, @Type, @Content, @Source)
              returning id",
            new
            {
                Title = "Initial template",
                Type = "Markdown",
                Content = "Original template content",
                Source = "migration-tests"
            });

        var insertedId = await connection.QuerySingleAsync<int>(
            @"insert into ai_prompt_template (name, document_id)
              values (@Name, @DocumentId)
              returning id",
            new
            {
                Name = "initial-template",
                DocumentId = documentId
            });

        var originalUpdatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from ai_prompt_template where id = @Id",
            new { Id = insertedId });

        await Task.Delay(1100);

        await connection.ExecuteAsync(
            "update ai_prompt_template set name = @Name where id = @Id",
            new { Name = "updated-template", Id = insertedId });

        var updatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from ai_prompt_template where id = @Id",
            new { Id = insertedId });

        Assert.True(updatedAt > originalUpdatedAt,
            $"Expected updated_at to change after update. Original: {originalUpdatedAt:o}, Updated: {updatedAt:o}");
    }
}
