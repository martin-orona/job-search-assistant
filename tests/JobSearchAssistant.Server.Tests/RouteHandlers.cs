using Dapper;

using JobSearchAssistant.DB;
using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;

namespace JobSearchAssistant.Server.Tests;

[Collection("SQLiteDatabase")]
public sealed class Server_Route_Handler_Tests : SqliteTestBase
{
    public Server_Route_Handler_Tests() : base("jobsearchassistant-server-route-handler-tests")
    {
    }

    [Fact]
    public async Task Documents_CreateRoute_ReturnsCreatedResult()
    {
        RunMigrations();

        var context = CreateJsonHttpContext(new
        {
            title = "Route test document",
            type = (int)DocumentType.Markdown,
            content = "Created from the server route handler.",
            source = "server-route-tests"
        });

        var result = await new global::JobSearchAssistant.Server.Documents().Create(context);

        Assert.Contains("CreatedAtRoute", result.GetType().Name);

        using var connection = Database.Connect();
        var matches = await connection.ExecuteScalarAsync<int>(
            "select count(*) from document where title = @Title",
            new { Title = "Route test document" });
        Assert.Equal(1, matches);
    }

    [Fact]
    public async Task Resumes_CreateRoute_ReturnsCreatedResult()
    {
        RunMigrations();

        var context = CreateJsonHttpContext(new
        {
            name = "Ada Lovelace",
            jobTitle = "Senior Engineer",
            date = DateTimeOffset.UtcNow,
            document = new
            {
                title = "Resume route document",
                type = (int)DocumentType.Markdown,
                content = "This is the resume body used by the route handler test.",
                source = "server-route-tests"
            }
        });

        var result = await new global::JobSearchAssistant.Server.Resumes().Create(context);

        Assert.Contains("CreatedAtRoute", result.GetType().Name);

        using var connection = Database.Connect();
        var matches = await connection.ExecuteScalarAsync<int>(
            "select count(*) from resume where name = @Name",
            new { Name = "Ada Lovelace" });
        Assert.Equal(1, matches);
    }

    [Fact]
    public async Task JobPostings_CreateRoute_ReturnsCreatedResult()
    {
        RunMigrations();

        var payload = new
        {
            title = "Senior .NET Engineer",
            company = "Contoso",
            location = "Remote",
            salary = "$160k",
            url = "https://example.com/jobs/senior-dotnet-engineer",
            workModel = (int)WorkModel.Remote,
            document = new
            {
                title = "Job posting route document",
                type = (int)DocumentType.Markdown,
                content = "# This is the job description payload for the route test.",
                source = "server-route-tests"
            },
        };

        var context = CreateJsonHttpContext(payload);

        var result = await new global::JobSearchAssistant.Server.JobPostings().Create(context);

        var responsePayload = Assert.IsType<CreatedAtRoute<JobPosting>>(result);
        var jobPosting = responsePayload.Value!;
        Assert.Equal(payload.title, jobPosting.Title);
        Assert.Equal(payload.company, jobPosting.Company);
        Assert.Equal(payload.location, jobPosting.Location);
        Assert.Equal(payload.salary, jobPosting.Salary);
        Assert.Equal(payload.url, jobPosting.Url);
        Assert.Equal(payload.workModel, (int)jobPosting.WorkModel);
        Assert.Equal(payload.document.title, jobPosting.Document.Title);
        Assert.Equal(payload.document.type, (int)jobPosting.Document.Type);
        Assert.Equal(payload.document.content, jobPosting.Document.Content);
        Assert.Equal(payload.document.source, jobPosting.Document.Source);

        Assert.Equal(StatusCodes.Status201Created, responsePayload.StatusCode);
    }

    [Fact]
    public async Task AiPromptTemplates_CreateRoute_ReturnsCreatedResult()
    {
        RunMigrations();

        var context = CreateJsonHttpContext(new
        {
            name = "resume-summary",
            template = "Summarize the candidate's background for a hiring manager."
        });

        var result = await new global::JobSearchAssistant.Server.AiPromptTemplates().Create(context);

        Assert.Contains("CreatedAtRoute", result.GetType().Name);
    }

    [Fact]
    public async Task AiPrompts_CreateRoute_ReturnsCreatedResult()
    {
        RunMigrations();

        var jobPosting = await new global::JobSearchAssistant.DB.Services.JobPostings().Create(new JobPosting
        {
            Title = "Senior Product Engineer",
            Company = "Northwind",
            Location = "Hybrid",
            WorkModel = WorkModel.Hybrid,
            Salary = "$170k",
            Url = "https://example.com/jobs/product-engineer",
            Document = new Document
            {
                Title = "AI prompt support document",
                Type = DocumentType.Markdown,
                Content = "Related to the AI prompt route test.",
                Source = "server-route-tests"
            }
        });
        Assert.NotNull(jobPosting);

        var resume = await new global::JobSearchAssistant.DB.Services.Resumes().Create(new Resume
        {
            Name = "Grace Hopper",
            JobTitle = "Principal Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Grace Hopper Resume",
                Type = DocumentType.Markdown,
                Content = "Related to the AI prompt route test.",
                Source = "server-route-tests"
            }
        });
        Assert.NotNull(resume);

        var template = await new global::JobSearchAssistant.DB.Services.AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "resume-screening",
            Template = "Review the resume for a fit score."
        });
        Assert.NotNull(template);

        var payload = new
        {
            name = "resume-screening-1",
            aiUrl = "https://example.com/ai/resume-screening",
            jobPostingId = jobPosting.Id,
            resumeId = resume.Id,
            aiPromptTemplateId = template.Id,
            promptDocument = new
            {
                title = "AI prompt support document",
                type = (int)DocumentType.Markdown,
                content = "Please compare this resume to the job posting.",
                source = "server-route-tests"
            },
            responseDocument = new
            {
                title = "AI prompt response document",
                type = (int)DocumentType.Markdown,
                content = "Strong match for the role.",
                source = "server-route-tests"
            }
        };

        var context = CreateJsonHttpContext(payload);

        var result = await new global::JobSearchAssistant.Server.AiPrompts().Create(context);

        var responsePayload = Assert.IsType<CreatedAtRoute<AiPrompt>>(result);
        var responseValue = responsePayload.Value;
        Assert.Equal(payload.name, responseValue.Name);
        Assert.Equal(payload.aiUrl, responseValue.AiUrl);
        Assert.Equal(payload.jobPostingId, responseValue.JobPostingId);
        Assert.Equal(payload.resumeId, responseValue.ResumeId);
        Assert.Equal(payload.aiPromptTemplateId, responseValue.AiPromptTemplateId);
        Assert.Equal(payload.promptDocument.title, responseValue.PromptDocument.Title);
        Assert.Equal(payload.promptDocument.type, (int)responseValue.PromptDocument.Type);
        Assert.Equal(payload.promptDocument.content, responseValue.PromptDocument.Content);
        Assert.Equal(payload.promptDocument.source, responseValue.PromptDocument.Source);
        Assert.Equal(payload.responseDocument.title, responseValue.ResponseDocument.Title);
        Assert.Equal(payload.responseDocument.type, (int)responseValue.ResponseDocument.Type);
        Assert.Equal(payload.responseDocument.content, responseValue.ResponseDocument.Content);
        Assert.Equal(payload.responseDocument.source, responseValue.ResponseDocument.Source);

        Assert.Equal(StatusCodes.Status201Created, responsePayload.StatusCode);
    }
}
