using Dapper;

using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests;

[Collection("SQLiteDatabase")]
public sealed class ai_prompt_table_Tests : SqliteTestBase
{
    public ai_prompt_table_Tests() : base("jobsearchassistant-ai-prompt-tests")
    {
    }

    [Fact]
    public void RunMigrations_CreatesExpectedTables()
    {
        RunMigrations();

        using var connection = Database.Connect();

        var tableCount = connection.QuerySingle<int>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'ai_prompt';");

        Assert.Equal(1, tableCount);
    }

    [Fact]
    public async Task AiPrompt_CreateAndGetById_RoundTripsData()
    {
        RunMigrations();

        // Create the full AI prompt graph via the CRUD layer, matching the real model relationships.
        var jobPosting = await new JobPostings().Create(new JobPosting
        {
            Title = "Software Engineer",
            Company = "Contoso",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$150k",
            Url = "https://example.com/jobs/software-engineer",
            Document = new Document
            {
                Title = "AI prompt job posting source",
                Type = DocumentType.Markdown,
                Content = "This is the source content for the related job posting.",
                Source = "ai-prompt-job-posting-test"
            }
        });
        Assert.NotNull(jobPosting);

        var resume = await new Resumes().Create(new Resume
        {
            Name = "Ada Lovelace",
            JobTitle = "Senior Software Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "AI prompt resume source",
                Type = DocumentType.Markdown,
                Content = "This is the source content for the candidate resume.",
                Source = "ai-prompt-resume-test"
            }
        });
        Assert.NotNull(resume);

        var template = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "resume-match-template",
            Template = "Match [YOUR RESUME HERE] against [JOB DESCRIPTION HERE]"
        });
        Assert.NotNull(template);

        var created = await new AiPrompts().Create(new AiPrompt
        {
            Name = "resume-match",
            AiUrl = "https://example.com/ai/resume-match",
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-test"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-test"
            }
        });
        Assert.NotNull(created);
        Assert.NotEqual(0, created.Id);

        var fetched = await new AiPrompts().GetById(created.Id);

        Assert.NotNull(fetched);
        Assert.Equal("resume-match", fetched!.Name);
        Assert.Equal("https://example.com/ai/resume-match", fetched.AiUrl);
        Assert.Equal(jobPosting.Id, fetched.JobPostingId);
        Assert.Equal(resume.Id, fetched.ResumeId);
        Assert.Equal(template.Id, fetched.AiPromptTemplateId);
        Assert.Equal(created.PromptDocumentId, fetched.PromptDocumentId);
        Assert.Equal(created.ResponseDocumentId, fetched.ResponseDocumentId);
    }

    [Fact]
    public async Task Updating_ai_prompt_updates_updatedat_via_trigger()
    {
        RunMigrations();

        var jobPosting = await new JobPostings().Create(new JobPosting
        {
            Title = "Software Engineer",
            Company = "Contoso",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$150k",
            Url = "https://example.com/jobs/software-engineer",
            Document = new Document
            {
                Title = "AI prompt trigger job posting",
                Type = DocumentType.Text,
                Content = "For update trigger validation.",
                Source = "trigger-test"
            }
        });
        Assert.NotNull(jobPosting);

        var resume = await new Resumes().Create(new Resume
        {
            Name = "Grace Hopper",
            JobTitle = "Principal Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "AI prompt trigger resume",
                Type = DocumentType.Text,
                Content = "For update trigger validation.",
                Source = "trigger-test"
            }
        });
        Assert.NotNull(resume);

        var template = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "trigger-template",
            Template = "Template content"
        });
        Assert.NotNull(template);

        var created = await new AiPrompts().Create(new AiPrompt
        {
            Name = "initial-name",
            AiUrl = "https://example.com/ai/initial",
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "trigger-test"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "trigger-test"
            }
        });
        Assert.NotNull(created);

        using var connection = Database.Connect();
        var originalUpdatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from ai_prompt where id = @Id",
            new { Id = created.Id });

        await Task.Delay(1100);

        await connection.ExecuteAsync(
            "update ai_prompt set name = @Name where id = @Id",
            new { Name = "updated-name", Id = created.Id });

        var updatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from ai_prompt where id = @Id",
            new { Id = created.Id });

        Assert.True(updatedAt > originalUpdatedAt,
            $"Expected updated_at to change after update. Original: {originalUpdatedAt:o}, Updated: {updatedAt:o}");
    }
}
