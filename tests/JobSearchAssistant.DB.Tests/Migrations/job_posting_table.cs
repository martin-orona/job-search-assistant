using Dapper;

using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests;

[Collection("SQLiteDatabase")]
public sealed class job_posting_table_Tests : SqliteTestBase
{
    public job_posting_table_Tests() : base("jobsearchassistant-job-posting-tests")
    {
    }

    [Fact]
    public void RunMigrations_CreatesExpectedTables()
    {
        RunMigrations();

        using var connection = Database.Connect();

        var tableCount = connection.QuerySingle<int>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('job_posting');");

        Assert.Equal(1, tableCount);
    }

    [Fact]
    public async Task JobPosting_CreateAndGetById_RoundTripsData()
    {
        RunMigrations();

        var created = await new JobPostings().Create(new JobPosting
        {
            Title = "Senior C# Developer",
            Company = "Contoso",
            WorkModel = WorkModel.Remote,
            Location = "Remote",
            Salary = "$150k",
            Url = "https://example.com/jobs/123",
            Document = new Document
            {
                Title = "Engineering job description",
                Type = DocumentType.Markdown,
                Content = "Job description content",
                Source = "unit-test"
            }
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created.Id);
        Assert.Equal("Senior C# Developer", created.Title);

        var fetched = await new JobPostings().GetById(created.Id);

        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("Contoso", fetched.Company);
    }

    [Fact]
    public async Task Updating_job_posting_updates_updatedat_via_trigger()
    {
        RunMigrations();

        var created = await new JobPostings().Create(new JobPosting
        {
            Title = "Initial title",
            Company = "Acme",
            WorkModel = WorkModel.Unknown,
            Location = "Seattle",
            Salary = "$120k",
            Url = "https://example.com/jobs/initial",
            Document = new Document
            {
                Title = "Source document",
                Type = DocumentType.Text,
                Content = "Engineering role",
                Source = "trigger-test"
            }
        });
        Assert.NotNull(created);

        using var connection = Database.Connect();
        var originalUpdatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from job_posting where id = @Id",
            new { created.Id });

        await Task.Delay(1100);

        await connection.ExecuteAsync(
            "update job_posting set title = @Title where id = @Id",
            new { Title = "Updated title", created.Id });

        var updatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from job_posting where id = @Id",
            new { created.Id });

        Assert.True(updatedAt > originalUpdatedAt,
            $"Expected updated_at to change after update. Original: {originalUpdatedAt:o}, Updated: {updatedAt:o}");
    }

    [Fact]
    public async Task JobPosting_fts_index_is_created_and_searches_document_fields()
    {
        RunMigrations();

        await new JobPostings().Create(new JobPosting
        {
            Title = "Senior C# Engineer",
            Company = "Northwind",
            WorkModel = WorkModel.Remote,
            Location = "Remote",
            Salary = "$160k",
            Url = "https://jobs.example.com/remote",
            Document = new Document
            {
                Title = "Role summary",
                Type = DocumentType.Markdown,
                Content = "This is a remote C# engineering role.",
                Source = "https://jobs.example.com/remote"
            }
        });

        using var connection = Database.Connect();

        var titleMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from job_posting_fts_index where title match 'engineer' ");

        var companyMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from job_posting_fts_index where company match 'northwind' ");

        var urlMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from job_posting_fts_index where url match 'jobs' ");

        Assert.Equal(1, titleMatches);
        Assert.Equal(1, companyMatches);
        Assert.Equal(1, urlMatches);
    }
}
