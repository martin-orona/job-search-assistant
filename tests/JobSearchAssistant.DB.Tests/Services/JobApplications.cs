using Dapper;
using System.Text.Json;

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
    public async Task JobQuestions_Create_StoresQuestionWithoutApplicationForeignKey()
    {
        RunMigrations();

        var created = await new JobQuestions().Create(new JobQuestion
        {
            Question = "What is your experience with streaming data systems?",
            Answer = "I have built event-driven pipelines using Kafka and Spark."
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created!.Id);
        Assert.Equal("What is your experience with streaming data systems?", created.Question);
        Assert.Equal("I have built event-driven pipelines using Kafka and Spark.", created.Answer);
    }

    [Fact]
    public async Task JobApplications_Create_PersistsCollectionPropertiesAsJson()
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
                Title = "Staff engineer posting",
                Type = DocumentType.Markdown,
                Content = "A staff engineering role",
                Source = "job-applications-collection-test"
            }
        });
        Assert.NotNull(jobPosting);

        var created = await new JobApplications().Create(new JobApplication
        {
            Company = "Northwind",
            Role = "Staff Engineer",
            AppliedOnDate = new DateOnly(2026, 9, 15),
            Status = ApplicationStatus.Saved,
            SourceId = source.Id,
            JobPostingId = jobPosting.Id,
            Questions =
            [
                new JobQuestion
                {
                    Question = "What is your experience with event-driven systems?",
                    Answer = "I have built Kafka-based streaming services."
                }
            ],
            PointsOfContact =
            [
                new PointOfContact("Hiring Manager", "Alex Smith", "alex@northwind.com", "555-0101")
            ],
            Notes =
            [
                new Note(new DateOnly(2026, 9, 15), "Submitted via portal.")
            ]
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created!.Id);
        Assert.Single(created.Questions);
        Assert.Single(created.PointsOfContact);
        Assert.Single(created.Notes);

        using var connection = Database.Connect();
        var storedQuestions = await connection.QuerySingleAsync<string>("select questions from job_application where id = @Id", new { created.Id });
        var storedContacts = await connection.QuerySingleAsync<string>("select points_of_contact from job_application where id = @Id", new { created.Id });
        var storedNotes = await connection.QuerySingleAsync<string>("select notes from job_application where id = @Id", new { created.Id });

        Assert.Contains("event-driven systems", storedQuestions, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("alex@northwind.com", storedContacts, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("Submitted via portal.", storedNotes, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task JobApplications_GetByIdDeep_LoadsSerializedCollectionProperties()
    {
        RunMigrations();

        var source = await new JobSources().Create(new JobSource { Name = "LinkedIn" });
        Assert.NotNull(source);

        var jobPosting = await new JobPostings().Create(new JobPosting
        {
            Title = "Senior Product Engineer",
            Company = "Contoso",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$180k",
            Url = "https://example.com/jobs/senior-product-engineer",
            Document = new Document
            {
                Title = "Senior Product Engineer role at Contoso",
                Type = DocumentType.Markdown,
                Content = "Remote product engineering role",
                Source = "manual"
            }
        });
        Assert.NotNull(jobPosting);

        var created = await new JobApplications().Create(new JobApplication
        {
            Company = "Contoso",
            Role = "Senior Product Engineer",
            AppliedOnDate = new DateOnly(2026, 9, 22),
            Status = ApplicationStatus.Draft,
            SourceId = source.Id,
            JobPostingId = jobPosting.Id,
            Notes =
            [
                new Note(new DateOnly(2026, 9, 22), "asdf 1")
            ],
            PointsOfContact =
            [
                new PointOfContact("Hiring Manager", "Jane Doe", "jane@contoso.com", "555-0102")
            ]
        });
        Assert.NotNull(created);

        var loaded = await new JobApplications().GetById(created.Id, deep: true);
        Assert.NotNull(loaded);
        Assert.Single(loaded!.Notes);
        Assert.Equal(new DateOnly(2026, 9, 22), loaded.Notes[0].date);
        Assert.Equal("asdf 1", loaded.Notes[0].content);
        Assert.Single(loaded.PointsOfContact);
        Assert.Equal("jane@contoso.com", loaded.PointsOfContact[0].email);
    }

    [Fact]
    public async Task JobApplications_GetAllDeep_LoadsSharedQuestionsViaJoinTable()
    {
        RunMigrations();

        var source = await new JobSources().Create(new JobSource { Name = "LinkedIn" });
        Assert.NotNull(source);

        var posting = await new JobPostings().Create(new JobPosting
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
                Source = "job-questions-shared-service"
            }
        });
        Assert.NotNull(posting);

        var firstApplication = await new JobApplications().Create(new JobApplication
        {
            Company = "Contoso",
            Role = "Data Engineer",
            AppliedOnDate = new DateOnly(2026, 9, 10),
            Status = ApplicationStatus.Applied,
            SourceId = source.Id,
            JobPostingId = posting.Id,
        });
        Assert.NotNull(firstApplication);

        var secondApplication = await new JobApplications().Create(new JobApplication
        {
            Company = "Contoso",
            Role = "Senior Data Engineer",
            AppliedOnDate = new DateOnly(2026, 9, 12),
            Status = ApplicationStatus.Saved,
            SourceId = source.Id,
            JobPostingId = posting.Id,
        });
        Assert.NotNull(secondApplication);

        var sharedQuestion = await new JobQuestions().Create(new JobQuestion
        {
            Question = "What is your LinkedIn profile?",
            Answer = "https://linkedin.com/in/example"
        });
        Assert.NotNull(sharedQuestion);

        using var connection = Database.Connect();
        await connection.ExecuteAsync(
            "insert into job_application_question (job_application_id, job_question_id) values (@FirstApplicationId, @QuestionId), (@SecondApplicationId, @QuestionId)",
            new
            {
                FirstApplicationId = firstApplication.Id,
                SecondApplicationId = secondApplication.Id,
                QuestionId = sharedQuestion.Id,
            });

        var applications = await new JobApplications().GetAll(deep: true);
        var firstRecord = Assert.Single(applications.Where(app => app.Id == firstApplication.Id));
        var secondRecord = Assert.Single(applications.Where(app => app.Id == secondApplication.Id));

        Assert.Contains(firstRecord.Questions, question => question.Id == sharedQuestion.Id && question.Question == "What is your LinkedIn profile?");
        Assert.Contains(secondRecord.Questions, question => question.Id == sharedQuestion.Id && question.Question == "What is your LinkedIn profile?");
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task JobApplications_Patch_QuestionsOnly_PersistsAndReusesMatchingQuestion(bool questionExists)
    {
        RunMigrations();
        var existingQuestion = questionExists
            ? await new JobQuestions().Create(new JobQuestion { Question = "fdsa", Answer = "asdf" })
            : null;
        var application = await new JobApplications().Create(new JobApplication
        {
            Company = "Contoso",
            Role = "Question patch regression",
            Status = ApplicationStatus.Draft,
            Source = new JobSource { Name = "Question regression" },
            JobPosting = new JobPosting
            {
                Title = "Question patch regression",
                Company = "Contoso",
                Location = "Remote",
                WorkModel = WorkModel.Remote,
                Salary = "$150,000",
                Url = "https://example.com/question-regression",
                Document = new Document { Title = "Question regression", Type = DocumentType.Text, Content = "Role description", Source = "question-regression" },
            },
        });
        Assert.NotNull(application);
        var patch = new Dictionary<string, object?>
        {
            ["questions"] = JsonSerializer.SerializeToElement(new[] { new { question = "fdsa", answer = "asdf" } }),
        };
        await new JobApplications().PartialUpdate(application.Id, patch);
        await new JobApplications().PartialUpdate(application.Id, patch);

        var loaded = await new JobApplications().GetById(application.Id, deep: true);
        Assert.NotNull(loaded);
        var question = Assert.Single(loaded.Questions);
        Assert.Equal("fdsa", question.Question);
        Assert.Equal("asdf", question.Answer);
        Assert.True(question.Id > 0);
        if (questionExists) Assert.Equal(existingQuestion!.Id, question.Id);
        Assert.Equal(application.Company, loaded.Company);
        using var connection = Database.Connect();
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>("select count(*) from job_question"));
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>("select count(*) from job_application_question where job_application_id = @Id", new { application.Id }));

        var invalidPatch = new Dictionary<string, object?>
        {
            ["role"] = "Must roll back",
            ["questions"] = JsonSerializer.SerializeToElement(new[]
            {
                new { question = "Must not become an orphan", answer = "Rollback" },
                new { question = "", answer = "Invalid" },
            }),
        };
        await Assert.ThrowsAsync<JobSearchAssistant.Core.AppException>(() => new JobApplications().PartialUpdate(application.Id, invalidPatch));
        var unchanged = await new JobApplications().GetById(application.Id, deep: true);
        Assert.NotNull(unchanged);
        Assert.Equal(application.Role, unchanged.Role);
        Assert.Equal(question.Id, Assert.Single(unchanged.Questions).Id);
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>("select count(*) from job_question"));

        await new JobApplications().PartialUpdate(application.Id, new Dictionary<string, object?>
        {
            ["questions"] = JsonSerializer.SerializeToElement(Array.Empty<JobQuestion>()),
        });
        var cleared = await new JobApplications().GetById(application.Id, deep: true);
        Assert.NotNull(cleared);
        Assert.Empty(cleared.Questions);
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>("select count(*) from job_question"));
        Assert.Equal(0, await connection.ExecuteScalarAsync<int>("select count(*) from job_application_question where job_application_id = @Id", new { application.Id }));
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
