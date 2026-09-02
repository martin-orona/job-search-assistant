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

        var insertedId = await connection.QuerySingleAsync<int>(
            @"insert into ai_prompt_template (name, template)
              values (@Name, @Template)
              returning id",
            new
            {
                Name = "resume-summary",
                Template = "Summarize the candidate profile for a technical hiring manager."
            });

        var row = await connection.QuerySingleAsync<dynamic>(
            "select name, template from ai_prompt_template where id = @Id",
            new { Id = insertedId });

        Assert.Equal("resume-summary", (string)row.name);
        Assert.Equal("Summarize the candidate profile for a technical hiring manager.", (string)row.template);
    }

    [Fact]
    public async Task Updating_ai_prompt_template_updates_updatedat_via_trigger()
    {
        RunMigrations();

        using var connection = Database.Connect();

        var insertedId = await connection.QuerySingleAsync<int>(
            @"insert into ai_prompt_template (name, template)
              values (@Name, @Template)
              returning id",
            new
            {
                Name = "initial-template",
                Template = "Original template content"
            });

        var originalUpdatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from ai_prompt_template where id = @Id",
            new { Id = insertedId });

        await Task.Delay(1100);

        await connection.ExecuteAsync(
            "update ai_prompt_template set template = @Template where id = @Id",
            new { Template = "Updated template content", Id = insertedId });

        var updatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from ai_prompt_template where id = @Id",
            new { Id = insertedId });

        Assert.True(updatedAt > originalUpdatedAt,
            $"Expected updated_at to change after update. Original: {originalUpdatedAt:o}, Updated: {updatedAt:o}");
    }
}
