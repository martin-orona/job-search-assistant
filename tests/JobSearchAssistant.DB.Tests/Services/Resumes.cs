using Dapper;

using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests.Services;

[Collection("SQLiteDatabase")]
public sealed class Resumes_Service_Tests : SqliteTestBase
{
    public Resumes_Service_Tests() : base("jobsearchassistant-resumes-service-tests")
    {
    }

    [Fact]
    public async Task Resumes_Create_ReturnsCreatedRecord()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Ada Lovelace",
            JobTitle = "Senior Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Resume source document",
                Type = DocumentType.Markdown,
                Content = "Candidate profile content",
                Source = "resumes-service"
            }
        });

        Assert.NotNull(created);
        Assert.NotEqual(0, created.Id);
        Assert.Equal("Ada Lovelace", created.Name);
        Assert.Equal("Senior Engineer", created.JobTitle);
        Assert.NotEqual(0, created.DocumentId);
    }

    [Fact]
    public async Task Resumes_GetAll_ReturnsResumesWithJoinedDocument()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Katherine Johnson",
            JobTitle = "Aerospace Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Resume join document",
                Type = DocumentType.Markdown,
                Content = "Joined content",
                Source = "resumes-getall-join"
            }
        });
        Assert.NotNull(created);

        var all = await new Resumes().GetAll(null);

        var found = Assert.Single(all, r => r.Id == created.Id);
        Assert.NotNull(found.Document);
        Assert.Equal(created.DocumentId, found.Document!.Id);
        Assert.Equal("Resume join document", found.Document.Title);
    }

    [Fact]
    public async Task Resumes_GetById_ReturnsMatchingResume()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Grace Hopper",
            JobTitle = "Principal Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Resume lookup document",
                Type = DocumentType.Text,
                Content = "Lookup content",
                Source = "resume-lookup"
            }
        });
        Assert.NotNull(created);

        var fetched = await new Resumes().GetById(created.Id);

        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("Grace Hopper", fetched.Name);
        Assert.Equal("Principal Engineer", fetched.JobTitle);
        Assert.Equal(created.DocumentId, fetched.DocumentId);
    }

    [Fact]
    public async Task Resumes_Update_UpdatesRecordValues()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Initial Name",
            JobTitle = "Initial Job Title",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Resume update document",
                Type = DocumentType.Text,
                Content = "Resume update content",
                Source = "resume-update"
            }
        });
        Assert.NotNull(created);

        var updated = await new Resumes().FullUpdate(created.Id, new Resume
        {
            Id = created.Id,
            Name = "Updated Name",
            JobTitle = "Updated Job Title",
            Date = DateTimeOffset.UtcNow.AddDays(1),
            DocumentId = created.DocumentId,
            Document = new Document
            {
                Id = created.DocumentId,
                Title = "Resume update document",
                Type = DocumentType.Text,
                Content = "Resume update content",
                Source = "resume-update"
            }
        });

        Assert.NotNull(updated);
        Assert.Equal(created.Id, updated!.Id);
        Assert.Equal("Updated Name", updated.Name);
        Assert.Equal("Updated Job Title", updated.JobTitle);
        Assert.Equal(created.DocumentId, updated.DocumentId);
    }

    [Fact]
    public async Task Resumes_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Original Name",
            JobTitle = "Original Title",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Resume patch document",
                Type = DocumentType.Markdown,
                Content = "Patch content",
                Source = "resume-patch"
            }
        });
        Assert.NotNull(created);

        var patched = await new Resumes().PartialUpdate(created.Id, new Dictionary<string, object?>
        {
            ["JobTitle"] = "Patched Title"
        });

        Assert.NotNull(patched);
        Assert.Equal(created.Id, patched!.Id);
        Assert.Equal("Original Name", patched.Name);
        Assert.Equal("Patched Title", patched.JobTitle);
        Assert.Equal(created.DocumentId, patched.DocumentId);
    }

    [Fact]
    public async Task Resumes_Delete_RemovesRecord()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Delete Me",
            JobTitle = "Delete Title",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Resume delete document",
                Type = DocumentType.Other,
                Content = "Will be removed",
                Source = "resume-delete"
            }
        });
        Assert.NotNull(created);

        var deleted = await new Resumes().Delete(created.Id);

        Assert.NotNull(deleted);
        Assert.Equal(created.Id, deleted!.Id);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from resume where id = @Id",
            new { Id = created.Id });

        Assert.Null(remaining);
    }
}
