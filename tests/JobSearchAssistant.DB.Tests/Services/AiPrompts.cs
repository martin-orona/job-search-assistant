using Dapper;

using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests.Services;

[Collection("SQLiteDatabase")]
public sealed class AiPrompts_Service_Tests : SqliteTestBase
{
    public AiPrompts_Service_Tests() : base("jobsearchassistant-ai-prompts-service-tests")
    {
    }

    private static async Task<(JobPosting jobPosting, Resume resume, AiPromptTemplate template)> CreateDependenciesAsync(string suffix)
    {
        var jobPosting = await new JobPostings().Create(new JobPosting
        {
            Title = "Senior Platform Engineer",
            Company = "Contoso",
            Location = "Remote",
            WorkModel = WorkModel.Remote,
            Salary = "$180k",
            Url = "https://example.com/jobs/platform-engineer",
            Document = new Document
            {
                Title = $"Prompt source document {suffix}",
                Type = DocumentType.Markdown,
                Content = "Used for AI prompt generation",
                Source = "ai-prompt-service"
            }
        });
        Assert.NotNull(jobPosting);

        var resume = await new Resumes().Create(new Resume
        {
            Name = "Ada Lovelace",
            JobTitle = "Principal Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = $"Resume source document {suffix}",
                Type = DocumentType.Markdown,
                Content = "Candidate profile content",
                Source = "ai-prompt-service"
            }
        });
        Assert.NotNull(resume);

        var template = await new AiPromptTemplates().Create(new AiPromptTemplate
        {
            Name = "resume-match-template",
            Template = "Match [YOUR RESUME HERE] against [JOB DESCRIPTION HERE]"
        });
        Assert.NotNull(template);

        return (jobPosting!, resume!, template!);
    }

    [Fact]
    public async Task AiPrompts_Create_ReturnsCreatedRecord()
    {
        RunMigrations();

        var (jobPosting, resume, template) = await CreateDependenciesAsync("create");

        var created = await new AiPrompts().Create(new AiPrompt
        {
            Name = "resume-match",
            AiUrl = "https://example.com/ai/resume-match",
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content create",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content create",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created.Id);
        Assert.Equal("resume-match", created.Name);
        Assert.Equal("https://example.com/ai/resume-match", created.AiUrl);
        Assert.Equal(jobPosting.Id, created.JobPostingId);
        Assert.Equal(resume.Id, created.ResumeId);
        Assert.Equal(template.Id, created.AiPromptTemplateId);
        Assert.NotEqual(0, created.PromptDocumentId);
        Assert.NotEqual(0, created.ResponseDocumentId);
    }

    [Fact]
    public async Task AiPrompts_GetById_ReturnsMatchingPrompt()
    {
        RunMigrations();

        var (jobPosting, resume, template) = await CreateDependenciesAsync("get-by-id");

        var created = await new AiPrompts().Create(new AiPrompt
        {
            Name = "ml-fit",
            AiUrl = "https://example.com/ai/ml-fit",
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content get-by-id",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content get-by-id",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        });
        Assert.NotNull(created);

        var fetched = await new AiPrompts().GetById(created.Id);

        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("ml-fit", fetched.Name);
        Assert.Equal("https://example.com/ai/ml-fit", fetched.AiUrl);
    }

    [Fact]
    public async Task AiPrompts_Update_UpdatesRecordValues()
    {
        RunMigrations();

        var (jobPosting, resume, template) = await CreateDependenciesAsync("update");

        var created = await new AiPrompts().Create(new AiPrompt
        {
            Name = "initial-ai-prompt",
            AiUrl = "https://example.com/ai/initial",
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content update",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content update",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        });
        Assert.NotNull(created);

        var promptDocument = await new Documents().GetById(created.PromptDocumentId);
        var responseDocument = await new Documents().GetById(created.ResponseDocumentId);
        Assert.NotNull(promptDocument);
        Assert.NotNull(responseDocument);

        var updated = await new AiPrompts().FullUpdate(created.Id, new AiPrompt
        {
            Id = created.Id,
            Name = "updated-ai-prompt",
            AiUrl = "https://example.com/ai/updated",
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocumentId = promptDocument.Id,
            ResponseDocumentId = responseDocument.Id,
            PromptDocument = promptDocument,
            ResponseDocument = responseDocument
        });

        Assert.NotNull(updated);
        Assert.Equal(created.Id, updated!.Id);
        Assert.Equal("updated-ai-prompt", updated.Name);
        Assert.Equal("https://example.com/ai/updated", updated.AiUrl);
    }

    [Fact]
    public async Task AiPrompts_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var (jobPosting, resume, template) = await CreateDependenciesAsync("patch");

        var created = await new AiPrompts().Create(new AiPrompt
        {
            Name = "patch-before",
            AiUrl = "https://example.com/ai/before",
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content patch",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content patch",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        });
        Assert.NotNull(created);

        var patched = await new AiPrompts().PartialUpdate(created.Id, new Dictionary<string, object?>
        {
            ["AiUrl"] = "https://example.com/ai/after"
        });

        Assert.NotNull(patched);
        Assert.Equal(created.Id, patched!.Id);
        Assert.Equal("patch-before", patched.Name);
        Assert.Equal("https://example.com/ai/after", patched.AiUrl);
    }

    [Fact]
    public async Task AiPrompts_Delete_RemovesRecord()
    {
        RunMigrations();

        var (jobPosting, resume, template) = await CreateDependenciesAsync("delete");

        var created = await new AiPrompts().Create(new AiPrompt
        {
            Name = "delete-me",
            AiUrl = "https://example.com/ai/delete-me",
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content delete",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content delete",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        });
        Assert.NotNull(created);

        var deleted = await new AiPrompts().Delete(created.Id);

        Assert.NotNull(deleted);
        Assert.Equal(created.Id, deleted!.Id);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from ai_prompt where id = @Id",
            new { Id = created.Id });

        Assert.Null(remaining);
    }

    [Fact]
    public async Task AiPrompts_Create_WithNestedObjects_CreatesTheWholeObjectGraph()
    {
        RunMigrations();

        var created = await new AiPrompts().Create(new AiPrompt
        {
            Name = "graph-create",
            AiUrl = "https://example.com/ai/graph-create",
            JobPosting = new JobPosting
            {
                Title = "Staff Engineer",
                Company = "Fabrikam",
                Location = "Remote",
                WorkModel = WorkModel.Remote,
                Salary = "$200k",
                Url = "https://example.com/jobs/staff-engineer",
                Document = new Document
                {
                    Title = "Job posting document graph-create",
                    Type = DocumentType.Markdown,
                    Content = "Job posting content",
                    Source = "ai-prompt-service"
                }
            },
            Resume = new Resume
            {
                Name = "Grace Hopper",
                JobTitle = "Staff Engineer",
                Date = DateTimeOffset.UtcNow,
                Document = new Document
                {
                    Title = "Resume document graph-create",
                    Type = DocumentType.Markdown,
                    Content = "Candidate profile content",
                    Source = "ai-prompt-service"
                }
            },
            AiPromptTemplate = new AiPromptTemplate
            {
                Name = "graph-create-template",
                Template = "Match [YOUR RESUME HERE] against [JOB DESCRIPTION HERE]"
            },
            PromptDocument = new Document
            {
                Title = "AI prompt content graph-create",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content graph-create",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created.JobPostingId);
        Assert.NotEqual(0, created.ResumeId);
        Assert.NotEqual(0, created.AiPromptTemplateId);
        Assert.NotEqual(0, created.PromptDocumentId);
        Assert.NotEqual(0, created.ResponseDocumentId);

        using var connection = Database.Connect();
        var storedJobPostingId = await connection.QuerySingleAsync<int>(
            "select job_posting_id from ai_prompt where id = @Id",
            new { created.Id });

        Assert.Equal(created.JobPostingId, storedJobPostingId);
    }

    [Fact]
    public async Task AiPrompts_Create_WithForeignKeyIdsOnly_LinksExistingRecords()
    {
        RunMigrations();

        var (jobPosting, resume, template) = await CreateDependenciesAsync("ids-only");

        var promptDocument = await new Documents().Create(new Document
        {
            Title = "AI prompt content ids-only",
            Type = DocumentType.Text,
            Content = "Generated prompt content",
            Source = "ai-prompt-service"
        });
        var responseDocument = await new Documents().Create(new Document
        {
            Title = "AI response content ids-only",
            Type = DocumentType.Text,
            Content = "Captured AI response content",
            Source = "ai-prompt-service"
        });
        Assert.NotNull(promptDocument);
        Assert.NotNull(responseDocument);

        var created = await new AiPrompts().Create(new AiPrompt
        {
            Name = "ids-only",
            AiUrl = "https://example.com/ai/ids-only",
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocumentId = promptDocument.Id,
            ResponseDocumentId = responseDocument.Id
        });

        Assert.NotNull(created);
        Assert.Equal(jobPosting.Id, created.JobPostingId);
        Assert.Equal(resume.Id, created.ResumeId);
        Assert.Equal(template.Id, created.AiPromptTemplateId);
        Assert.Equal(promptDocument.Id, created.PromptDocumentId);
        Assert.Equal(responseDocument.Id, created.ResponseDocumentId);
    }

    [Fact]
    public async Task AiPrompts_Create_WithNeitherObjectNorId_FailsValidation()
    {
        RunMigrations();

        var (_, resume, template) = await CreateDependenciesAsync("missing-both");

        var exception = await Assert.ThrowsAsync<JobSearchAssistant.Core.ValidationException>(() => new AiPrompts().Create(new AiPrompt
        {
            Name = "missing-both",
            AiUrl = "https://example.com/ai/missing-both",
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content missing-both",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content missing-both",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        }));

        var error = Assert.Single(exception.ValidationErrors, e => e.Field == "JobPosting");
        Assert.Equal("When creating a new record, either [JobPosting] or [JobPostingId] must be provided.", error.Message);
    }

    [Fact]
    public async Task AiPrompts_Create_WithExistingObjectAndNoForeignKeyId_FailsValidation()
    {
        RunMigrations();

        var (jobPosting, resume, template) = await CreateDependenciesAsync("object-only");

        var exception = await Assert.ThrowsAsync<JobSearchAssistant.Core.ValidationException>(() => new AiPrompts().Create(new AiPrompt
        {
            Name = "object-only",
            AiUrl = "https://example.com/ai/object-only",
            JobPosting = jobPosting,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content object-only",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content object-only",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        }));

        var error = Assert.Single(exception.ValidationErrors, e => e.Field == "JobPosting");
        Assert.Equal(
            $"Field [JobPosting] has Id [{jobPosting.Id}]. A child object may only be sent when creating a new child record \u2014 to link an existing record, send [JobPostingId] instead and omit [JobPosting].",
            error.Message);
    }

    [Fact]
    public async Task AiPrompts_Create_WithExistingObjectAndMatchingForeignKeyId_FailsValidation()
    {
        RunMigrations();

        var (jobPosting, resume, template) = await CreateDependenciesAsync("object-with-id-and-fk");

        var exception = await Assert.ThrowsAsync<JobSearchAssistant.Core.ValidationException>(() => new AiPrompts().Create(new AiPrompt
        {
            Name = "object-with-id-and-fk",
            AiUrl = "https://example.com/ai/object-with-id-and-fk",
            JobPosting = jobPosting,
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content object-with-id-and-fk",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content object-with-id-and-fk",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        }));

        var error = Assert.Single(exception.ValidationErrors, e => e.Field == "JobPosting");
        Assert.Equal(
            $"Field [JobPosting] has Id [{jobPosting.Id}]. A child object may only be sent when creating a new child record \u2014 to link an existing record, send [JobPostingId] instead and omit [JobPosting].",
            error.Message);
    }

    [Fact]
    public async Task AiPrompts_Create_WithContradictoryObjectAndId_FailsValidation()
    {
        RunMigrations();

        var (jobPosting, resume, template) = await CreateDependenciesAsync("contradictory");
        var (otherJobPosting, _, _) = await CreateDependenciesAsync("contradictory-other");

        var exception = await Assert.ThrowsAsync<JobSearchAssistant.Core.ValidationException>(() => new AiPrompts().Create(new AiPrompt
        {
            Name = "contradictory",
            AiUrl = "https://example.com/ai/contradictory",
            JobPosting = jobPosting,
            JobPostingId = otherJobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content contradictory",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content contradictory",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        }));

        var error = Assert.Single(exception.ValidationErrors, e => e.Field == "JobPosting");
        Assert.Equal(
            $"Field [JobPosting] has Id [{jobPosting.Id}]. A child object may only be sent when creating a new child record \u2014 to link an existing record, send [JobPostingId] instead and omit [JobPosting].",
            error.Message);
    }

    [Fact]
    public async Task AiPrompts_Create_WithNewObjectAndExistingId_FailsValidation()
    {
        RunMigrations();

        var (jobPosting, resume, template) = await CreateDependenciesAsync("new-object-and-id");

        var exception = await Assert.ThrowsAsync<JobSearchAssistant.Core.ValidationException>(() => new AiPrompts().Create(new AiPrompt
        {
            Name = "new-object-and-id",
            AiUrl = "https://example.com/ai/new-object-and-id",
            JobPosting = new JobPosting
            {
                Title = "Staff Engineer",
                Company = "Fabrikam",
                Location = "Remote",
                WorkModel = WorkModel.Remote,
                Salary = "$200k",
                Url = "https://example.com/jobs/staff-engineer-new-object-and-id",
                Document = new Document
                {
                    Title = "Job posting document new-object-and-id",
                    Type = DocumentType.Markdown,
                    Content = "Job posting content",
                    Source = "ai-prompt-service"
                }
            },
            JobPostingId = jobPosting.Id,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content new-object-and-id",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content new-object-and-id",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        }));

        var error = Assert.Single(exception.ValidationErrors, e => e.Field == "JobPosting");
        Assert.Equal(
            "Only one of [JobPosting] or [JobPostingId] may be provided when creating a new record. [JobPosting] creates a new child record; [JobPostingId] links to an existing one.",
            error.Message);
    }

    [Fact]
    public async Task AiPrompts_Create_WithUnknownForeignKeyId_IsRejectedByTheDatabase()
    {
        RunMigrations();

        var (_, resume, template) = await CreateDependenciesAsync("unknown-fk");

        await Assert.ThrowsAsync<JobSearchAssistant.Core.DatabaseException>(() => new AiPrompts().Create(new AiPrompt
        {
            Name = "unknown-fk",
            AiUrl = "https://example.com/ai/unknown-fk",
            JobPostingId = 999999,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content unknown-fk",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content unknown-fk",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        }));
    }

    [Fact]
    public async Task AiPrompts_Create_WithNegativeForeignKeyId_FailsValidation()
    {
        RunMigrations();

        var (_, resume, template) = await CreateDependenciesAsync("negative-fk");

        var exception = await Assert.ThrowsAsync<JobSearchAssistant.Core.ValidationException>(() => new AiPrompts().Create(new AiPrompt
        {
            Name = "negative-fk",
            AiUrl = "https://example.com/ai/negative-fk",
            JobPostingId = -1,
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content negative-fk",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content negative-fk",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        }));

        var error = Assert.Single(exception.ValidationErrors, e => e.Field == "JobPostingId");
        Assert.Equal("Field [JobPostingId] has invalid value [-1]. Record IDs must be greater than 0.", error.Message);
    }

    [Fact]
    public async Task AiPrompts_Create_WithNegativeIdOnChildObject_FailsValidation()
    {
        RunMigrations();

        var (_, resume, template) = await CreateDependenciesAsync("negative-child-id");

        var exception = await Assert.ThrowsAsync<JobSearchAssistant.Core.ValidationException>(() => new AiPrompts().Create(new AiPrompt
        {
            Name = "negative-child-id",
            AiUrl = "https://example.com/ai/negative-child-id",
            JobPosting = new JobPosting
            {
                Id = -1,
                Title = "Staff Engineer",
                Company = "Fabrikam",
                Location = "Remote",
                WorkModel = WorkModel.Remote,
                Salary = "$200k",
                Url = "https://example.com/jobs/staff-engineer-negative-child-id",
                Document = new Document
                {
                    Title = "Job posting document negative-child-id",
                    Type = DocumentType.Markdown,
                    Content = "Job posting content",
                    Source = "ai-prompt-service"
                }
            },
            ResumeId = resume.Id,
            AiPromptTemplateId = template.Id,
            PromptDocument = new Document
            {
                Title = "AI prompt content negative-child-id",
                Type = DocumentType.Text,
                Content = "Generated prompt content",
                Source = "ai-prompt-service"
            },
            ResponseDocument = new Document
            {
                Title = "AI response content negative-child-id",
                Type = DocumentType.Text,
                Content = "Captured AI response content",
                Source = "ai-prompt-service"
            }
        }));

        var error = Assert.Single(exception.ValidationErrors, e => e.Field == "JobPosting");
        Assert.StartsWith("Field [JobPosting] has Id [-1].", error.Message);
    }
}
