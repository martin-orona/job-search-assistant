using Dapper;

using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests.Services;

[Collection("SQLiteDatabase")]
public sealed class AiPromptTemplates_Service_Tests : SqliteTestBase
{
    public AiPromptTemplates_Service_Tests() : base("jobsearchassistant-ai-prompt-templates-service-tests")
    {
    }

    [Fact]
    public async Task AiPromptTemplates_Create_ReturnsCreatedRecord()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "resume-summary",
            Template = "Summarize the candidate profile using clear, role-oriented language."
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created.Id);
        Assert.Equal("resume-summary", created.Name);
        Assert.Equal("Summarize the candidate profile using clear, role-oriented language.", created.Template);
    }

    [Fact]
    public async Task AiPromptTemplates_GetById_ReturnsMatchingTemplate()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "job-evaluation",
            Template = "Evaluate the work experience and fit for the target role."
        });
        Assert.NotNull(created);

        var fetched = await new AiPromptTemplates().GetById(created.Id);

        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("job-evaluation", fetched.Name);
        Assert.Equal("Evaluate the work experience and fit for the target role.", fetched.Template);
    }

    [Fact]
    public async Task AiPromptTemplates_Update_UpdatesRecordValues()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "before-update",
            Template = "Original template content"
        });
        Assert.NotNull(created);

        var updated = await new AiPromptTemplates().FullUpdate(created.Id, new AiPromptTemplate
        {
            Id = created.Id,
            Name = "after-update",
            Template = "Updated template content"
        });

        Assert.NotNull(updated);
        Assert.Equal(created.Id, updated!.Id);
        Assert.Equal("after-update", updated.Name);
        Assert.Equal("Updated template content", updated.Template);
    }

    [Fact]
    public async Task AiPromptTemplates_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "original-name",
            Template = "Original template content"
        });
        Assert.NotNull(created);

        var patched = await new AiPromptTemplates().PartialUpdate(created.Id, new Dictionary<string, object?>
        {
            ["Template"] = "Patched template content"
        });

        Assert.NotNull(patched);
        Assert.Equal(created.Id, patched!.Id);
        Assert.Equal("original-name", patched.Name);
        Assert.Equal("Patched template content", patched.Template);
    }

    [Fact]
    public async Task AiPromptTemplates_Delete_RemovesRecord()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "delete-me",
            Template = "This template will be deleted"
        });
        Assert.NotNull(created);

        var deleted = await new AiPromptTemplates().Delete(created.Id);

        Assert.NotNull(deleted);
        Assert.Equal(created.Id, deleted!.Id);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from ai_prompt_template where id = @Id",
            new { Id = created.Id });

        Assert.Null(remaining);
    }
}
