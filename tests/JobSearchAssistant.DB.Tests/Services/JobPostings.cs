using Dapper;

using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests.Services;

[Collection("SQLiteDatabase")]
public sealed class JobPostings_Service_Tests : SqliteTestBase
{
    public JobPostings_Service_Tests() : base("jobsearchassistant-job-postings-service-tests")
    {
    }

    [Fact]
    public async Task JobPostings_Create_ReturnsCreatedRecord()
    {
        RunMigrations();

        var created = await new JobPostings().Create(new JobPosting
        {
            Title = "Senior .NET Developer",
            Company = "Contoso",
            Location = "Austin, TX",
            WorkModel = WorkModel.Remote,
            Salary = "$140k",
            Url = "https://example.com/jobs/contoso-net",
            Document = new Document
            {
                Title = "Service create test",
                Type = DocumentType.Markdown,
                Content = "Created via service",
                Source = "job-postings-service"
            }
        });

        Assert.NotNull(created);

        Assert.NotEqual(0, created.Id);
        Assert.Equal("Senior .NET Developer", created.Title);
        Assert.Equal("Contoso", created.Company);
        Assert.NotEqual(0, created.DocumentId);

        using var connection = Database.Connect();
        var storedWorkModel = await connection.QuerySingleAsync<string>(
            "select work_model from job_posting where id = @Id",
            new { created.Id });
        Assert.Equal(nameof(WorkModel.Remote), storedWorkModel);
    }

    [Fact]
    public async Task JobPostings_GetById_ReturnsMatchingJobPosting()
    {
        RunMigrations();

        var created = await new JobPostings().Create(new JobPosting
        {
            Title = "Platform Engineer",
            Company = "Northwind",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$170k",
            Url = "https://example.com/jobs/platform-engineer",
            Document = new Document
            {
                Title = "Lookup document",
                Type = DocumentType.Text,
                Content = "Lookup content",
                Source = "job-posting-lookup"
            }
        });
        Assert.NotNull(created);

        var fetched = await new JobPostings().GetById(created.Id);

        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("Platform Engineer", fetched.Title);
        Assert.Equal("Northwind", fetched.Company);
        Assert.Equal(created.DocumentId, fetched.DocumentId);
    }

    [Fact]
    public async Task JobPostings_Update_UpdatesRecordValues()
    {
        RunMigrations();

        var created = await new JobPostings().Create(new JobPosting
        {
            Title = "Initial title",
            Company = "Acme",
            Location = "Seattle, WA",
            WorkModel = WorkModel.InOffice,
            Salary = "$110k",
            Url = "https://example.com/jobs/acme-initial",
            Document = new Document
            {
                Title = "Before update",
                Type = DocumentType.Text,
                Content = "Original content",
                Source = "job-posting-update"
            }
        });
        Assert.NotNull(created);

        var updated = await new JobPostings().FullUpdate(created.Id, new JobPosting
        {
            Id = created.Id,
            Title = "Updated title",
            Company = "Acme Corp",
            Location = "Portland, OR",
            WorkModel = WorkModel.Hybrid,
            Salary = "$125k",
            Url = "https://example.com/jobs/acme-updated",
            DocumentId = created.DocumentId,
            Document = new Document
            {
                Id = created.DocumentId,
                Title = "Before update",
                Type = DocumentType.Text,
                Content = "Original content",
                Source = "job-posting-update"
            }
        });

        Assert.NotNull(updated);
        Assert.Equal(created.Id, updated!.Id);
        Assert.Equal("Updated title", updated.Title);
        Assert.Equal("Acme Corp", updated.Company);
        Assert.Equal("Portland, OR", updated.Location);
        Assert.Equal(WorkModel.Hybrid, updated.WorkModel);
        Assert.Equal("$125k", updated.Salary);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task JobPostings_Update_WithNonPositiveId_FailsValidation(int invalidId)
    {
        RunMigrations();

        var created = await new JobPostings().Create(new JobPosting
        {
            Title = "Initial title",
            Company = "Acme",
            Location = "Seattle, WA",
            WorkModel = WorkModel.InOffice,
            Salary = "$110k",
            Url = "https://example.com/jobs/acme-initial-invalid-id",
            Document = new Document
            {
                Title = "Before update",
                Type = DocumentType.Text,
                Content = "Original content",
                Source = "job-posting-update"
            }
        });
        Assert.NotNull(created);

        var exception = await Assert.ThrowsAsync<JobSearchAssistant.Core.ValidationException>(() => new JobPostings().FullUpdate(invalidId, new JobPosting
        {
            Title = "Updated title",
            Company = "Acme Corp",
            Location = "Portland, OR",
            WorkModel = WorkModel.Hybrid,
            Salary = "$125k",
            Url = "https://example.com/jobs/acme-updated-invalid-id",
            DocumentId = created.DocumentId,
            Document = new Document
            {
                Id = created.DocumentId,
                Title = "Before update",
                Type = DocumentType.Text,
                Content = "Original content",
                Source = "job-posting-update"
            }
        }));

        var error = Assert.Single(exception.ValidationErrors, e => e.Field == "Id");
        Assert.Equal($"Field [Id] has invalid value [{invalidId}]. Record IDs must be greater than 0.", error.Message);
    }

    [Fact]
    public async Task JobPostings_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var created = await new JobPostings().Create(new JobPosting
        {
            Title = "Original title",
            Company = "Original company",
            Location = "Original city",
            WorkModel = WorkModel.Unknown,
            Salary = "$100k",
            Url = "https://example.com/jobs/original",
            Document = new Document
            {
                Title = "Original document",
                Type = DocumentType.Markdown,
                Content = "Original job description",
                Source = "job-posting-patch"
            }
        });
        Assert.NotNull(created);

        var patched = await new JobPostings().PartialUpdate(created.Id, new Dictionary<string, object?>
        {
            ["Location"] = "Updated city",
            ["Salary"] = "$115k",
            ["WorkModel"] = WorkModel.Remote
        });

        Assert.NotNull(patched);
        Assert.Equal(created.Id, patched!.Id);
        Assert.Equal("Original title", patched.Title);
        Assert.Equal("Original company", patched.Company);
        Assert.Equal("Updated city", patched.Location);
        Assert.Equal("$115k", patched.Salary);
        Assert.Equal(WorkModel.Remote, patched.WorkModel);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task JobPostings_Patch_WithNonPositiveId_FailsValidation(int invalidId)
    {
        RunMigrations();

        var created = await new JobPostings().Create(new JobPosting
        {
            Title = "Original title",
            Company = "Original company",
            Location = "Original city",
            WorkModel = WorkModel.Unknown,
            Salary = "$100k",
            Url = "https://example.com/jobs/original-invalid-id",
            Document = new Document
            {
                Title = "Original document",
                Type = DocumentType.Markdown,
                Content = "Original job description",
                Source = "job-posting-patch"
            }
        });
        Assert.NotNull(created);

        var exception = await Assert.ThrowsAsync<JobSearchAssistant.Core.ValidationException>(() => new JobPostings().PartialUpdate(invalidId, new Dictionary<string, object?>
        {
            ["Location"] = "Updated city"
        }));

        var error = Assert.Single(exception.ValidationErrors, e => e.Field == "Id");
        Assert.Equal($"Field [Id] has invalid value [{invalidId}]. Record IDs must be greater than 0.", error.Message);
    }

    [Fact]
    public async Task JobPostings_Delete_RemovesRecord()
    {
        RunMigrations();

        var created = await new JobPostings().Create(new JobPosting
        {
            Title = "Delete me",
            Company = "Delete Co",
            Location = "Delete City",
            WorkModel = WorkModel.Unknown,
            Salary = "$90k",
            Url = "https://example.com/jobs/delete-me",
            Document = new Document
            {
                Title = "Delete document",
                Type = DocumentType.Other,
                Content = "Will be deleted",
                Source = "job-posting-delete"
            }
        });
        Assert.NotNull(created);

        var deleted = await new JobPostings().Delete(created.Id);

        Assert.NotNull(deleted);
        Assert.Equal(created.Id, deleted!.Id);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from job_posting where id = @Id",
            new { Id = created.Id });

        Assert.Null(remaining);
    }
}
