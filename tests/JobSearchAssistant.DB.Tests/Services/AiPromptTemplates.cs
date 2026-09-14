using System.Text.Json;

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
    public async Task AiPromptTemplates_Create_UsesDocumentBackingStore()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "resume-summary",
            Document = new Document
            {
                Title = "Resume summary template",
                Type = DocumentType.Markdown,
                Content = "Summarize the candidate profile using clear, role-oriented language.",
                Source = "tests"
            }
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created.Id);
        Assert.Equal("resume-summary", created.Name);
        Assert.NotEqual(0, created.DocumentId);
        Assert.Equal("Resume summary template", created.Document.Title);
        Assert.Equal("Summarize the candidate profile using clear, role-oriented language.", created.Document.Content);
    }

    [Fact]
    public async Task AiPromptTemplates_Create_ReturnsCreatedRecord()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "resume-summary",
            Document = new Document
            {
                Title = "Resume summary template",
                Type = DocumentType.Markdown,
                Content = "Summarize the candidate profile using clear, role-oriented language.",
                Source = "tests"
            }
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created.Id);
        Assert.Equal("resume-summary", created.Name);
        Assert.NotEqual(0, created.DocumentId);
        Assert.Equal("Summarize the candidate profile using clear, role-oriented language.", created.Document.Content);
    }

    [Fact]
    public async Task AiPromptTemplates_GetById_ReturnsMatchingTemplate()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "job-evaluation",
            Document = new Document
            {
                Title = "Job evaluation template",
                Type = DocumentType.Markdown,
                Content = "Evaluate the work experience and fit for the target role.",
                Source = "tests"
            }
        });
        Assert.NotNull(created);

        var fetched = await new AiPromptTemplates().GetById(created.Id);

        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("job-evaluation", fetched.Name);
        Assert.Equal("Evaluate the work experience and fit for the target role.", fetched.Document.Content);
    }

    [Fact]
    public async Task AiPromptTemplates_Update_UpdatesRecordValues()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "before-update",
            Document = new Document
            {
                Title = "Before update template",
                Type = DocumentType.Markdown,
                Content = "Original template content",
                Source = "tests"
            }
        });
        Assert.NotNull(created);

        var updated = await new AiPromptTemplates().FullUpdate(created.Id, new AiPromptTemplate
        {
            Id = created.Id,
            Name = "after-update",
            DocumentId = created.DocumentId,
            Document = new Document
            {
                Id = created.DocumentId,
                Title = "After update template",
                Type = DocumentType.Markdown,
                Content = "Updated template content",
                Source = "tests"
            }
        });

        Assert.NotNull(updated);
        Assert.Equal(created.Id, updated!.Id);
        Assert.Equal("after-update", updated.Name);
        Assert.Equal("Updated template content", updated.Document.Content);
    }

    [Fact]
    public async Task AiPromptTemplates_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "original-name",
            Document = new Document
            {
                Title = "Original patch template",
                Type = DocumentType.Markdown,
                Content = "Original template content",
                Source = "tests"
            }
        });
        Assert.NotNull(created);

        var patched = await new AiPromptTemplates().PartialUpdate(created.Id, new Dictionary<string, object?>
        {
            ["documentId"] = created.DocumentId,
            ["document"] = JsonDocument.Parse($"{{\"id\": {created.DocumentId}, \"title\": \"Original patch template\", \"type\": {(int)DocumentType.Markdown}, \"content\": \"Patched template content\", \"source\": \"tests\"}}")
                .RootElement,
        });

        Assert.NotNull(patched);
        Assert.Equal(created.Id, patched!.Id);
        Assert.Equal("original-name", patched.Name);
        Assert.Equal("Patched template content", patched.Document.Content);
    }

    [Fact]
    public async Task AiPromptTemplates_Delete_RemovesRecord()
    {
        RunMigrations();

        var created = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "delete-me",
            Document = new Document
            {
                Title = "Delete template",
                Type = DocumentType.Markdown,
                Content = "This template will be deleted",
                Source = "tests"
            }
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
