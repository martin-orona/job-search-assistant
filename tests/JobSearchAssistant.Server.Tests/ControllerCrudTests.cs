using System.Text;
using System.Text.Json;

using Dapper;

using Microsoft.AspNetCore.Http.HttpResults;

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
    public async Task JobPostings_GetAll_DeepTrue_ReturnsDocumentWhenPresent()
    {
        RunMigrations();

        var document = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = "Deep job posting source",
            Type = DocumentType.Markdown,
            Content = "Deep job description",
            Source = "job-postings-deep-list"
        });
        Assert.NotNull(document);

        var created = await new global::JobSearchAssistant.DB.Services.JobPostings().Create(new JobPosting
        {
            Title = "Deep job posting",
            Company = "Deep Co",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$110k",
            Url = "https://example.com/jobs/deep-job",
            DocumentId = document.Id
        });
        Assert.NotNull(created);

        var result = await new global::JobSearchAssistant.Server.JobPostings().GetAll(deep: true);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        var body = await ReadResponseBodyAsync(context);
        Assert.Contains("\"document\"", body);
        Assert.Contains("Deep job description", body);

        using var payload = JsonDocument.Parse(body);
        var items = payload.RootElement;
        Assert.Equal(JsonValueKind.Array, items.ValueKind);
        Assert.NotEmpty(items.EnumerateArray());

        foreach (var item in items.EnumerateArray())
        {
            Assert.True(item.TryGetProperty("id", out var idElement));
            Assert.True(idElement.TryGetInt32(out var id));
            Assert.True(id > 0, $"Expected a positive record id in deep job-posting response, got {id}.");

            Assert.True(item.TryGetProperty("document", out var documentElement));
            Assert.True(documentElement.TryGetProperty("id", out var documentIdElement));
            Assert.True(documentIdElement.TryGetInt32(out var documentId));
            Assert.True(documentId > 0, $"Expected a positive document id in deep job-posting response, got {documentId}.");
            Assert.Equal("Deep job description", documentElement.GetProperty("content").GetString());
        }
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
            Document = new Document
            {
                Title = "Before update template",
                Type = DocumentType.Markdown,
                Content = "Original template",
                Source = "server-tests"
            }
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new
        {
            name = "after-update",
            documentId = created.DocumentId,
            document = new
            {
                id = created.DocumentId,
                title = "After update template",
                type = (int)DocumentType.Markdown,
                content = "Updated template",
                source = "server-tests"
            }
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
            Document = new Document
            {
                Title = "Before patch template",
                Type = DocumentType.Markdown,
                Content = "Original template",
                Source = "server-tests"
            }
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new Dictionary<string, object?>
        {
            ["documentId"] = created.DocumentId,
            ["document"] = new Dictionary<string, object?>
            {
                ["id"] = created.DocumentId,
                ["title"] = "Before patch template",
                ["type"] = (int)DocumentType.Markdown,
                ["content"] = "Patched template",
                ["source"] = "server-tests"
            }
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
            "select content from document where id = @Id",
            new { Id = created.DocumentId });

        Assert.Equal("Patched template", patchedTemplate);
    }

    [Fact]
    public async Task AiPromptTemplates_Delete_RemovesRecord()
    {
        RunMigrations();

        var created = await new global::JobSearchAssistant.DB.Services.AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "delete-me",
            Document = new Document
            {
                Title = "Delete template",
                Type = DocumentType.Markdown,
                Content = "This template will be deleted",
                Source = "server-tests"
            }
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
    public async Task AiPrompts_GetAll_DeepTrue_ReturnsNestedObjects()
    {
        RunMigrations();

        var dependencies = await CreateDependenciesAsync("deep-list");
        var created = await new global::JobSearchAssistant.DB.Services.AiPrompts().Create(new AiPrompt
        {
            Name = "deep-list-prompt",
            AiUrl = "https://example.com/ai/deep-list",
            JobPostingId = dependencies.jobPosting.Id,
            ResumeId = dependencies.resume.Id,
            AiPromptTemplateId = dependencies.template.Id,
            PromptDocumentId = dependencies.promptDocument.Id,
            ResponseDocumentId = dependencies.responseDocument.Id
        });
        Assert.NotNull(created);

        var result = await new global::JobSearchAssistant.Server.AiPrompts().GetAll(deep: true);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        var body = await ReadResponseBodyAsync(context);
        Assert.Contains("\"jobPosting\"", body);
        Assert.Contains("\"resume\"", body);
        Assert.Contains("\"aiPromptTemplate\"", body);
        Assert.Contains("\"promptDocument\"", body);
        Assert.Contains("\"responseDocument\"", body);
        Assert.Contains("deep-list-prompt", body);

        using var payload = JsonDocument.Parse(body);
        var items = payload.RootElement;
        Assert.Equal(JsonValueKind.Array, items.ValueKind);
        Assert.NotEmpty(items.EnumerateArray());

        foreach (var item in items.EnumerateArray())
        {
            Assert.True(item.TryGetProperty("id", out var idElement));
            Assert.True(idElement.TryGetInt32(out var id));
            Assert.True(id > 0, $"Expected a positive AI prompt id in deep response, got {id}.");

            Assert.True(item.TryGetProperty("jobPosting", out var jobPostingElement));
            Assert.True(jobPostingElement.TryGetProperty("id", out var jobPostingIdElement));
            Assert.True(jobPostingIdElement.TryGetInt32(out var jobPostingId));
            Assert.True(jobPostingId > 0, $"Expected a positive nested jobPosting id in deep response, got {jobPostingId}.");
        }
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

    [Fact]
    public async Task AiPrompts_Delete_WithSelectedRelatedRecords_DeletesThemInOneRequest()
    {
        RunMigrations();

        var dependencies = await CreateDependenciesAsync("delete-with-related");
        var created = await new global::JobSearchAssistant.DB.Services.AiPrompts().Create(new AiPrompt
        {
            Name = "delete-with-related",
            AiUrl = "https://example.com/ai/delete-with-related",
            JobPostingId = dependencies.jobPosting.Id,
            ResumeId = dependencies.resume.Id,
            AiPromptTemplateId = dependencies.template.Id,
            PromptDocumentId = dependencies.promptDocument.Id,
            ResponseDocumentId = dependencies.responseDocument.Id
        });
        Assert.NotNull(created);

        var request = CreateJsonHttpContext(new
        {
            include = new[]
            {
                new { entity = "job-postings", id = dependencies.jobPosting.Id },
                new { entity = "resumes", id = dependencies.resume.Id },
                new { entity = "ai-prompt-templates", id = dependencies.template.Id },
            }
        });

        var result = await new global::JobSearchAssistant.Server.AiPrompts().Delete(created.Id, request);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);

        using var connection = Database.Connect();

        Assert.Null(await connection.QuerySingleOrDefaultAsync<int?>("select id from ai_prompt where id = @Id", new { created.Id }));
        Assert.Null(await connection.QuerySingleOrDefaultAsync<int?>("select id from job_posting where id = @Id", new { dependencies.jobPosting.Id }));
        Assert.Null(await connection.QuerySingleOrDefaultAsync<int?>("select id from resume where id = @Id", new { dependencies.resume.Id }));
        Assert.Null(await connection.QuerySingleOrDefaultAsync<int?>("select id from ai_prompt_template where id = @Id", new { dependencies.template.Id }));
    }

    [Fact]
    public async Task AiPrompts_Delete_WhenReferencedByAnotherRecord_ReturnsFriendlyErrorAndRollsBack()
    {
        RunMigrations();

        var dependencies = await CreateDependenciesAsync("delete-blocked");
        var target = await new global::JobSearchAssistant.DB.Services.JobPostings().Create(new JobPosting
        {
            Title = "Delete blocked posting",
            Company = "Contoso",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$120k",
            Url = "https://example.com/jobs/delete-blocked",
            Document = new Document
            {
                Title = "Delete blocked posting document",
                Type = DocumentType.Markdown,
                Content = "Blocked posting content",
                Source = "delete-blocked"
            }
        });
        Assert.NotNull(target);

        var prompt = await new global::JobSearchAssistant.DB.Services.AiPrompts().Create(new AiPrompt
        {
            Name = "blocking prompt",
            AiUrl = "https://example.com/ai/blocking",
            JobPostingId = target.Id,
            ResumeId = dependencies.resume.Id,
            AiPromptTemplateId = dependencies.template.Id,
            PromptDocumentId = dependencies.promptDocument.Id,
            ResponseDocumentId = dependencies.responseDocument.Id
        });
        Assert.NotNull(prompt);

        var request = CreateJsonHttpContext(new { include = Array.Empty<object>() });
        var result = await new global::JobSearchAssistant.Server.JobPostings().Delete(target.Id, request);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status400BadRequest, response.Response.StatusCode);

        response.Response.Body.Position = 0;
        using var reader = new StreamReader(response.Response.Body, Encoding.UTF8, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        Assert.Contains("AI Prompt records", body);
        Assert.Contains("Delete the AI Prompt records first", body);

        using var connection = Database.Connect();
        var stillExists = await connection.QuerySingleOrDefaultAsync<int?>("select id from job_posting where id = @Id", new { target.Id });
        Assert.Equal(target.Id, stillExists);
    }

    [Fact]
    public async Task AiPrompts_Delete_WhenSelectedRelatedJobPostingIsBlockedByAnotherAiPrompt_ReturnsChildEntityMessageAndRollsBack()
    {
        RunMigrations();

        var dependencies = await CreateDependenciesAsync("delete-blocked-child");
        var sharedJobPosting = await new global::JobSearchAssistant.DB.Services.JobPostings().Create(new JobPosting
        {
            Title = "Shared blocked job posting",
            Company = "Contoso",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$130k",
            Url = "https://example.com/jobs/shared-blocked",
            Document = new Document
            {
                Title = "Shared blocked job posting document",
                Type = DocumentType.Markdown,
                Content = "Shared content",
                Source = "shared-blocked"
            }
        });
        Assert.NotNull(sharedJobPosting);

        var targetPrompt = await new global::JobSearchAssistant.DB.Services.AiPrompts().Create(new AiPrompt
        {
            Name = "target prompt to delete",
            AiUrl = "https://example.com/ai/target-delete",
            JobPostingId = sharedJobPosting.Id,
            ResumeId = dependencies.resume.Id,
            AiPromptTemplateId = dependencies.template.Id,
            PromptDocumentId = dependencies.promptDocument.Id,
            ResponseDocumentId = dependencies.responseDocument.Id
        });
        Assert.NotNull(targetPrompt);

        var blockerPrompt = await new global::JobSearchAssistant.DB.Services.AiPrompts().Create(new AiPrompt
        {
            Name = "other prompt still referencing shared posting",
            AiUrl = "https://example.com/ai/blocker-delete",
            JobPostingId = sharedJobPosting.Id,
            ResumeId = dependencies.resume.Id,
            AiPromptTemplateId = dependencies.template.Id,
            PromptDocumentId = dependencies.promptDocument.Id,
            ResponseDocumentId = dependencies.responseDocument.Id
        });
        Assert.NotNull(blockerPrompt);

        var request = CreateJsonHttpContext(new
        {
            include = new[]
            {
                new { entity = "job-postings", id = sharedJobPosting.Id }
            }
        });

        var result = await new global::JobSearchAssistant.Server.AiPrompts().Delete(targetPrompt.Id, request);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status400BadRequest, response.Response.StatusCode);

        response.Response.Body.Position = 0;
        using var reader = new StreamReader(response.Response.Body, Encoding.UTF8, leaveOpen: true);
        var body = await reader.ReadToEndAsync();
        Assert.Contains("The AI Prompt record could not be deleted because it references a Job Posting", body);
        Assert.Contains("still referenced by other AI Prompt records", body);
        Assert.Contains("Remove that reference(s), or do not select to delete the Job Posting, and try again", body);

        using var connection = Database.Connect();
        var promptStillExists = await connection.QuerySingleOrDefaultAsync<int?>("select id from ai_prompt where id = @Id", new { targetPrompt.Id });
        Assert.Equal(targetPrompt.Id, promptStillExists);

        var postingStillExists = await connection.QuerySingleOrDefaultAsync<int?>("select id from job_posting where id = @Id", new { sharedJobPosting.Id });
        Assert.Equal(sharedJobPosting.Id, postingStillExists);
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
            Document = new Document
            {
                Title = $"Template {suffix}",
                Type = DocumentType.Markdown,
                Content = "Evaluate the candidate for the role.",
                Source = "ai-prompts-controller"
            }
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

[Collection("SQLiteDatabase")]
public sealed class JobApplications_Controller_Tests : SqliteTestBase
{
    public JobApplications_Controller_Tests() : base("jobsearchassistant-job-applications-controller-tests")
    {
    }

    [Fact]
    public async Task JobApplications_GetById_ReturnsNotFound_WhenRecordDoesNotExist()
    {
        RunMigrations();

        var result = await new global::JobSearchAssistant.Server.JobApplications().GetById(404);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status404NotFound, context.Response.StatusCode);
    }

    [Fact]
    public async Task JobApplications_Create_ReturnsCreatedApplication()
    {
        RunMigrations();

        var source = await new global::JobSearchAssistant.DB.Services.JobSources().Create(new JobSource
        {
            Name = "LinkedIn"
        });
        Assert.NotNull(source);

        var jobPosting = await new global::JobSearchAssistant.DB.Services.JobPostings().Create(new JobPosting
        {
            Title = "Senior Engineer",
            Company = "Contoso",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$150k",
            Url = "https://example.com/jobs/senior-engineer",
            Document = new Document
            {
                Title = "Senior Engineer description",
                Type = DocumentType.Markdown,
                Content = "Job description",
                Source = "job-applications-controller"
            }
        });
        Assert.NotNull(jobPosting);

        var context = CreateJsonHttpContext(new
        {
            company = "Contoso",
            role = "Senior Engineer",
            appliedOnDate = (DateOnly?)null,
            status = (int)ApplicationStatus.Draft,
            sourceId = source.Id,
            jobPostingId = jobPosting.Id,
        });

        var result = await new global::JobSearchAssistant.Server.JobApplications().Create(context);

        var payload = Assert.IsType<CreatedAtRoute<JobApplication>>(result);
        Assert.Equal("Contoso", payload.Value!.Company);
        Assert.Equal("Senior Engineer", payload.Value.Role);
        Assert.Equal(StatusCodes.Status201Created, payload.StatusCode);

        using var connection = Database.Connect();
        var createdCount = await connection.QuerySingleAsync<int>(
            "select count(*) from job_application where company = @Company and role = @Role",
            new { Company = "Contoso", Role = "Senior Engineer" });

        Assert.Equal(1, createdCount);
    }

    [Fact]
    public async Task JobApplications_Delete_RemovesRecord()
    {
        RunMigrations();

        var source = await new global::JobSearchAssistant.DB.Services.JobSources().Create(new JobSource
        {
            Name = "Indeed"
        });
        Assert.NotNull(source);

        var jobPosting = await new global::JobSearchAssistant.DB.Services.JobPostings().Create(new JobPosting
        {
            Title = "Platform Engineer",
            Company = "Northwind",
            Location = "Hybrid",
            WorkModel = WorkModel.Hybrid,
            Salary = "$140k",
            Url = "https://example.com/jobs/platform-engineer",
            Document = new Document
            {
                Title = "Platform Engineer description",
                Type = DocumentType.Markdown,
                Content = "Platform role description",
                Source = "job-applications-delete"
            }
        });
        Assert.NotNull(jobPosting);

        var created = await new global::JobSearchAssistant.DB.Services.JobApplications().Create(new JobApplication
        {
            Company = "Northwind",
            Role = "Platform Engineer",
            AppliedOnDate = null,
            Status = ApplicationStatus.Draft,
            SourceId = source.Id,
            JobPostingId = jobPosting.Id
        });
        Assert.NotNull(created);

        var result = await new global::JobSearchAssistant.Server.JobApplications().Delete(created.Id);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from job_application where id = @Id",
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
