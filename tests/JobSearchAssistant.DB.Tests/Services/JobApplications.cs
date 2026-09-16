using Dapper;

using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests.Services;

[Collection("SQLiteDatabase")]
public sealed class JobApplications_Service_Tests : SqliteTestBase
{
    public JobApplications_Service_Tests() : base("jobsearchassistant-job-applications-service-tests")
    {
    }

    [Fact]
    public async Task JobSources_Create_ReturnsCreatedRecord()
    {
        RunMigrations();

        var created = await new JobSources().Create(new JobSource
        {
            Name = "LinkedIn"
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created!.Id);
        Assert.Equal("LinkedIn", created.Name);
    }

    [Fact]
    public async Task JobApplications_Create_WithNestedSourceAndJobPosting_CreatesRecord()
    {
        RunMigrations();

        var created = await new JobApplications().Create(new JobApplication
        {
            Company = "Northwind",
            Role = "Senior Product Engineer",
            AppliedOnDate = new DateOnly(2026, 9, 15),
            Status = ApplicationStatus.Saved,
            Source = new JobSource
            {
                Name = "LinkedIn"
            },
            JobPosting = new JobPosting
            {
                Title = "Senior Product Engineer",
                Company = "Northwind",
                Location = "Remote",
                WorkModel = WorkModel.Remote,
                Salary = "$180k",
                Url = "https://example.com/jobs/senior-product-engineer",
                Document = new Document
                {
                    Title = "Job posting source",
                    Type = DocumentType.Markdown,
                    Content = "Complete job description text",
                    Source = "job-applications-service"
                }
            },
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created!.Id);
        Assert.Equal("Northwind", created.Company);
        Assert.Equal("Senior Product Engineer", created.Role);
        Assert.Equal(ApplicationStatus.Saved, created.Status);
        Assert.NotEqual(0, created.SourceId);
        Assert.NotEqual(0, created.JobPostingId);

        using var connection = Database.Connect();
        var storedDate = await connection.QuerySingleAsync<string>(
            "select applied_on_date from job_application where id = @Id",
            new { created.Id });
        Assert.Equal("2026-09-15", storedDate);
    }

    [Fact]
    public async Task JobQuestions_Create_WithApplicationId_StoresQuestion()
    {
        RunMigrations();

        var jobPosting = await new JobPostings().Create(new JobPosting
        {
            Title = "Data Engineer",
            Company = "Contoso",
            Location = "Austin, TX",
            WorkModel = WorkModel.Hybrid,
            Salary = "$165k",
            Url = "https://example.com/jobs/data-engineer",
            Document = new Document
            {
                Title = "Data engineer posting",
                Type = DocumentType.Markdown,
                Content = "Data engineering role",
                Source = "job-questions-service"
            }
        });
        Assert.NotNull(jobPosting);

        var application = await new JobApplications().Create(new JobApplication
        {
            Company = "Contoso",
            Role = "Data Engineer",
            AppliedOnDate = new DateOnly(2026, 9, 10),
            Status = ApplicationStatus.Applied,
            Source = new JobSource
            {
                Name = "Company website"
            },
            JobPostingId = jobPosting.Id,
        });
        Assert.NotNull(application);

        var question = await new JobQuestions().Create(new JobQuestion
        {
            JobApplicationId = application.Id,
            Question = "What is your experience with streaming data systems?",
            Answer = "I have built event-driven pipelines using Kafka and Spark."
        });

        Assert.NotNull(question);
        Assert.NotEqual(0, question!.Id);
        Assert.Equal(application.Id, question.JobApplicationId);
        Assert.Equal("What is your experience with streaming data systems?", question.Question);
    }

    [Fact]
    public async Task JobApplications_GetAllDeep_IgnoresCollectionProperties()
    {
        RunMigrations();

        var source = await new JobSources().Create(new JobSource { Name = "LinkedIn" });
        Assert.NotNull(source);

        var jobPosting = await new JobPostings().Create(new JobPosting
        {
            Title = "Staff Engineer",
            Company = "Northwind",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$200k",
            Url = "https://example.com/jobs/staff-engineer",
            Document = new Document
            {
                Title = "Staff Engineer posting",
                Type = DocumentType.Markdown,
                Content = "A staff engineering role",
                Source = "job-applications-deep-test"
            }
        });
        Assert.NotNull(jobPosting);

        var created = await new JobApplications().Create(new JobApplication
        {
            Company = "Northwind",
            Role = "Staff Engineer",
            AppliedOnDate = null,
            Status = ApplicationStatus.Draft,
            SourceId = source.Id,
            JobPostingId = jobPosting.Id,
        });
        Assert.NotNull(created);

        var records = await new JobApplications().GetAll(deep: true);

        Assert.NotEmpty(records);
        Assert.Contains(records, record => record.Id == created.Id && record.Company == "Northwind");
    }
}
