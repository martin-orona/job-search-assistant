using System.Text;

using Dapper;

using JobSearchAssistant.DB;
using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

using Microsoft.AspNetCore.Http;

namespace JobSearchAssistant.Server.Tests;

[Collection("SQLiteDatabase")]
public sealed class Resumes_Controller_Tests : SqliteTestBase
{
    public Resumes_Controller_Tests() : base("jobsearchassistant-resumes-controller-tests")
    {
    }

    [Fact]
    public async Task Resumes_GetById_ReturnsNotFound_WhenRecordDoesNotExist()
    {
        RunMigrations();

        var result = await new global::JobSearchAssistant.Server.Resumes().GetById(404);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status404NotFound, context.Response.StatusCode);
    }

    [Fact]
    public async Task Resumes_Update_ReturnsUpdatedResume()
    {
        RunMigrations();

        var document = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = "Resume update source",
            Type = DocumentType.Markdown,
            Content = "Updated resume body",
            Source = "resume-controller-update"
        });
        Assert.NotNull(document);

        var created = await new global::JobSearchAssistant.DB.Services.Resumes().Create(new Resume
        {
            Name = "Before update",
            JobTitle = "Junior Engineer",
            Date = DateTimeOffset.UtcNow,
            DocumentId = document.Id
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new
        {
            name = "After update",
            jobTitle = "Senior Engineer",
            date = DateTimeOffset.UtcNow.AddDays(1),
            documentId = document.Id,
            document = new
            {
                id = document.Id,
                title = "Resume update source",
                type = (int)DocumentType.Markdown,
                content = "Updated resume body",
                source = "resume-controller-update"
            }
        });

        var result = await new global::JobSearchAssistant.Server.Resumes().Update(created.Id, context);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);
        var body = await ReadResponseBodyAsync(response);
        Assert.Contains("After update", body);
        Assert.Contains("Senior Engineer", body);

        using var connection = Database.Connect();
        var updatedName = await connection.QuerySingleAsync<string>(
            "select name from resume where id = @Id",
            new { created.Id });

        Assert.Equal("After update", updatedName);
    }

    [Fact]
    public async Task Resumes_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var document = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = "Resume patch source",
            Type = DocumentType.Text,
            Content = "Original resume body",
            Source = "resume-controller-patch"
        });
        Assert.NotNull(document);

        var created = await new global::JobSearchAssistant.DB.Services.Resumes().Create(new Resume
        {
            Name = "Patched Name",
            JobTitle = "Original Title",
            Date = DateTimeOffset.UtcNow,
            DocumentId = document.Id
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new Dictionary<string, object?>
        {
            ["jobTitle"] = "Patched Title"
        });

        var result = await new global::JobSearchAssistant.Server.Resumes().Patch(created.Id, context);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);
        var body = await ReadResponseBodyAsync(response);
        Assert.Contains("Patched Name", body);
        Assert.Contains("Patched Title", body);

        using var connection = Database.Connect();
        var patchedTitle = await connection.QuerySingleAsync<string>(
            "select job_title from resume where id = @Id",
            new { created.Id });

        Assert.Equal("Patched Title", patchedTitle);
    }

    [Fact]
    public async Task Resumes_Delete_RemovesRecord()
    {
        RunMigrations();

        var document = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = "Resume delete source",
            Type = DocumentType.Other,
            Content = "Will be deleted",
            Source = "resume-controller-delete"
        });
        Assert.NotNull(document);

        var created = await new global::JobSearchAssistant.DB.Services.Resumes().Create(new Resume
        {
            Name = "Delete Me",
            JobTitle = "Delete Title",
            Date = DateTimeOffset.UtcNow,
            DocumentId = document.Id
        });
        Assert.NotNull(created);

        var result = await new global::JobSearchAssistant.Server.Resumes().Delete(created.Id);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from resume where id = @Id",
            new { created.Id });

        Assert.Null(remaining);
    }

    private static async Task<string> ReadResponseBodyAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body, Encoding.UTF8, leaveOpen: true);
        return await reader.ReadToEndAsync();
    }
}

[Collection("SQLiteDatabase")]
public sealed class JobPostings_Controller_Tests : SqliteTestBase
{
    public JobPostings_Controller_Tests() : base("jobsearchassistant-job-postings-controller-tests")
    {
    }

    [Fact]
    public async Task JobPostings_GetById_ReturnsNotFound_WhenRecordDoesNotExist()
    {
        RunMigrations();

        var result = await new global::JobSearchAssistant.Server.JobPostings().GetById(404);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status404NotFound, context.Response.StatusCode);
    }

    [Fact]
    public async Task JobPostings_Update_ReturnsUpdatedJobPosting()
    {
        RunMigrations();

        var document = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = "Job update source",
            Type = DocumentType.Markdown,
            Content = "Original job description",
            Source = "job-postings-controller-update"
        });
        Assert.NotNull(document);

        var created = await new global::JobSearchAssistant.DB.Services.JobPostings().Create(new JobPosting
        {
            Title = "Before update",
            Company = "Old Co",
            Location = "Remote",
            WorkModel = WorkModel.Unknown,
            Salary = "$100k",
            Url = "https://example.com/jobs/before-update",
            DocumentId = document.Id
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new
        {
            title = "After update",
            company = "New Co",
            location = "Hybrid",
            salary = "$120k",
            workModel = (int)WorkModel.Hybrid,
            url = "https://example.com/jobs/after-update",
            documentId = document.Id,
            document = new
            {
                id = document.Id,
                title = "Job update source",
                type = (int)DocumentType.Markdown,
                content = "Updated job description",
                source = "job-postings-controller-update"
            }
        });

        var result = await new global::JobSearchAssistant.Server.JobPostings().Update(created.Id, context);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);
        var body = await ReadResponseBodyAsync(response);
        Assert.Contains("After update", body);
        Assert.Contains("New Co", body);

        using var connection = Database.Connect();
        var updatedTitle = await connection.QuerySingleAsync<string>(
            "select title from job_posting where id = @Id",
            new { created.Id });

        Assert.Equal("After update", updatedTitle);
    }

    [Fact]
    public async Task JobPostings_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var document = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = "Job patch source",
            Type = DocumentType.Text,
            Content = "Patch job description",
            Source = "job-postings-controller-patch"
        });
        Assert.NotNull(document);

        var created = await new global::JobSearchAssistant.DB.Services.JobPostings().Create(new JobPosting
        {
            Title = "Original title",
            Company = "Original company",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$100k",
            Url = "https://example.com/jobs/original",
            DocumentId = document.Id
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new Dictionary<string, object?>
        {
            ["salary"] = "$130k",
            ["location"] = "Seattle, WA"
        });

        var result = await new global::JobSearchAssistant.Server.JobPostings().Patch(created.Id, context);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);
        var body = await ReadResponseBodyAsync(response);
        Assert.Contains("Original title", body);
        Assert.Contains("$130k", body);
        Assert.Contains("Seattle, WA", body);

        using var connection = Database.Connect();
        var updatedSalary = await connection.QuerySingleAsync<string>(
            "select salary from job_posting where id = @Id",
            new { created.Id });

        Assert.Equal("$130k", updatedSalary);
    }

    [Fact]
    public async Task JobPostings_Delete_RemovesRecord()
    {
        RunMigrations();

        var document = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = "Job delete source",
            Type = DocumentType.Other,
            Content = "Will be removed",
            Source = "job-postings-controller-delete"
        });
        Assert.NotNull(document);

        var created = await new global::JobSearchAssistant.DB.Services.JobPostings().Create(new JobPosting
        {
            Title = "Delete me",
            Company = "Delete Co",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$90k",
            Url = "https://example.com/jobs/delete-me",
            DocumentId = document.Id
        });
        Assert.NotNull(created);

        var result = await new global::JobSearchAssistant.Server.JobPostings().Delete(created.Id);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from job_posting where id = @Id",
            new { created.Id });

        Assert.Null(remaining);
    }

    private static async Task<string> ReadResponseBodyAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body, Encoding.UTF8, leaveOpen: true);
        return await reader.ReadToEndAsync();
    }
}

[Collection("SQLiteDatabase")]
public sealed class AiPromptTemplates_Controller_Tests : SqliteTestBase
{
    public AiPromptTemplates_Controller_Tests() : base("jobsearchassistant-ai-prompt-templates-controller-tests")
    {
    }

    [Fact]
    public async Task AiPromptTemplates_GetById_ReturnsNotFound_WhenRecordDoesNotExist()
    {
        RunMigrations();

        var result = await new global::JobSearchAssistant.Server.AiPromptTemplates().GetById(404);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status404NotFound, context.Response.StatusCode);
    }

    [Fact]
    public async Task AiPromptTemplates_Update_ReturnsUpdatedTemplate()
    {
        RunMigrations();

        var created = await new global::JobSearchAssistant.DB.Services.AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "before-update",
            Template = "Original template"
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new
        {
            name = "after-update",
            template = "Updated template"
        });

        var result = await new global::JobSearchAssistant.Server.AiPromptTemplates().Update(created.Id, context);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);
        var body = await ReadResponseBodyAsync(response);
        Assert.Contains("after-update", body);
        Assert.Contains("Updated template", body);

        using var connection = Database.Connect();
        var updatedName = await connection.QuerySingleAsync<string>(
            "select name from ai_prompt_template where id = @Id",
            new { created.Id });

        Assert.Equal("after-update", updatedName);
    }

    [Fact]
    public async Task AiPromptTemplates_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var created = await new global::JobSearchAssistant.DB.Services.AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "before-patch",
            Template = "Original template"
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new Dictionary<string, object?>
        {
            ["template"] = "Patched template"
        });

        var result = await new global::JobSearchAssistant.Server.AiPromptTemplates().Patch(created.Id, context);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);
        var body = await ReadResponseBodyAsync(response);
        Assert.Contains("before-patch", body);
        Assert.Contains("Patched template", body);

        using var connection = Database.Connect();
        var patchedTemplate = await connection.QuerySingleAsync<string>(
            "select template from ai_prompt_template where id = @Id",
            new { created.Id });

        Assert.Equal("Patched template", patchedTemplate);
    }

    [Fact]
    public async Task AiPromptTemplates_Delete_RemovesRecord()
    {
        RunMigrations();

        var created = await new global::JobSearchAssistant.DB.Services.AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "delete-me",
            Template = "This template will be deleted"
        });
        Assert.NotNull(created);

        var result = await new global::JobSearchAssistant.Server.AiPromptTemplates().Delete(created.Id);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from ai_prompt_template where id = @Id",
            new { created.Id });

        Assert.Null(remaining);
    }

    private static async Task<string> ReadResponseBodyAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body, Encoding.UTF8, leaveOpen: true);
        return await reader.ReadToEndAsync();
    }
}

[Collection("SQLiteDatabase")]
public sealed class AiPrompts_Controller_Tests : SqliteTestBase
{
    public AiPrompts_Controller_Tests() : base("jobsearchassistant-ai-prompts-controller-tests")
    {
    }

    [Fact]
    public async Task AiPrompts_GetById_ReturnsNotFound_WhenRecordDoesNotExist()
    {
        RunMigrations();

        var result = await new global::JobSearchAssistant.Server.AiPrompts().GetById(404);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status404NotFound, context.Response.StatusCode);
    }

    [Fact]
    public async Task AiPrompts_Update_ReturnsUpdatedPrompt()
    {
        RunMigrations();

        var dependencies = await CreateDependenciesAsync("update");

        var created = await new global::JobSearchAssistant.DB.Services.AiPrompts().Create(new AiPrompt
        {
            Name = "before-update",
            AiUrl = "https://example.com/ai/before-update",
            JobPostingId = dependencies.jobPosting.Id,
            ResumeId = dependencies.resume.Id,
            AiPromptTemplateId = dependencies.template.Id,
            PromptDocumentId = dependencies.promptDocument.Id,
            ResponseDocumentId = dependencies.responseDocument.Id
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new
        {
            name = "after-update",
            aiUrl = "https://example.com/ai/after-update",
            jobPostingId = created.JobPostingId,
            resumeId = created.ResumeId,
            aiPromptTemplateId = created.AiPromptTemplateId,
            promptDocumentId = created.PromptDocumentId,
            responseDocumentId = created.ResponseDocumentId
        });

        var result = await new global::JobSearchAssistant.Server.AiPrompts().Update(created.Id, context);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);
        var body = await ReadResponseBodyAsync(response);
        Assert.Contains("after-update", body);
        Assert.Contains("https://example.com/ai/after-update", body);

        using var connection = Database.Connect();
        var updatedName = await connection.QuerySingleAsync<string>(
            "select name from ai_prompt where id = @Id",
            new { created.Id });

        Assert.Equal("after-update", updatedName);
    }

    [Fact]
    public async Task AiPrompts_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var dependencies = await CreateDependenciesAsync("patch");

        var created = await new global::JobSearchAssistant.DB.Services.AiPrompts().Create(new AiPrompt
        {
            Name = "before-patch",
            AiUrl = "https://example.com/ai/before-patch",
            JobPostingId = dependencies.jobPosting.Id,
            ResumeId = dependencies.resume.Id,
            AiPromptTemplateId = dependencies.template.Id,
            PromptDocumentId = dependencies.promptDocument.Id,
            ResponseDocumentId = dependencies.responseDocument.Id
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new Dictionary<string, object?>
        {
            ["aiUrl"] = "https://example.com/ai/after-patch"
        });

        var result = await new global::JobSearchAssistant.Server.AiPrompts().Patch(created.Id, context);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);
        var body = await ReadResponseBodyAsync(response);
        Assert.Contains("before-patch", body);
        Assert.Contains("https://example.com/ai/after-patch", body);

        using var connection = Database.Connect();
        var patchedUrl = await connection.QuerySingleAsync<string>(
            "select ai_url from ai_prompt where id = @Id",
            new { created.Id });

        Assert.Equal("https://example.com/ai/after-patch", patchedUrl);
    }

    [Fact]
    public async Task AiPrompts_Delete_RemovesRecord()
    {
        RunMigrations();

        var dependencies = await CreateDependenciesAsync("delete");

        var created = await new global::JobSearchAssistant.DB.Services.AiPrompts().Create(new AiPrompt
        {
            Name = "delete-me",
            AiUrl = "https://example.com/ai/delete-me",
            JobPostingId = dependencies.jobPosting.Id,
            ResumeId = dependencies.resume.Id,
            AiPromptTemplateId = dependencies.template.Id,
            PromptDocumentId = dependencies.promptDocument.Id,
            ResponseDocumentId = dependencies.responseDocument.Id
        });
        Assert.NotNull(created);

        var result = await new global::JobSearchAssistant.Server.AiPrompts().Delete(created.Id);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from ai_prompt where id = @Id",
            new { created.Id });

        Assert.Null(remaining);
    }

    private static async Task<(JobPosting jobPosting, Resume resume, AiPromptTemplate template, Document promptDocument, Document responseDocument)> CreateDependenciesAsync(string suffix)
    {
        var jobPosting = await new global::JobSearchAssistant.DB.Services.JobPostings().Create(new JobPosting
        {
            Title = $"Senior Engineer {suffix}",
            Company = "Contoso",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$150k",
            Url = $"https://example.com/jobs/{suffix}",
            Document = new Document
            {
                Title = $"Senior Engineer {suffix} job posting document",
                Type = DocumentType.Markdown,
                Content = "job posting document content",
                Source = "ai-prompts-controller"
            }
        });
        Assert.NotNull(jobPosting);

        var resume = await new global::JobSearchAssistant.DB.Services.Resumes().Create(new Resume
        {
            Name = $"Candidate {suffix}",
            JobTitle = "Staff Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = $"Candidate {suffix} resume document",
                Type = DocumentType.Markdown,
                Content = "resume document content",
                Source = "ai-prompts-controller"
            }
        });
        Assert.NotNull(resume);

        var template = await new global::JobSearchAssistant.DB.Services.AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = $"template-{suffix}",
            Template = "Evaluate the candidate for the role."
        });
        Assert.NotNull(template);

        var promptDocument = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = $"Prompt document {suffix}",
            Type = DocumentType.Text,
            Content = "Prompt text",
            Source = "ai-prompts-controller"
        });
        Assert.NotNull(promptDocument);

        var responseDocument = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = $"Response document {suffix}",
            Type = DocumentType.Text,
            Content = "Response text",
            Source = "ai-prompts-controller"
        });
        Assert.NotNull(responseDocument);

        return (jobPosting!, resume!, template!, promptDocument!, responseDocument!);
    }

    private static async Task<string> ReadResponseBodyAsync(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var reader = new StreamReader(context.Response.Body, Encoding.UTF8, leaveOpen: true);
        return await reader.ReadToEndAsync();
    }
}
