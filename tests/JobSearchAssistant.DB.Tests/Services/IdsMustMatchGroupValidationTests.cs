using System.Text.Json;

using JobSearchAssistant.Core;
using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests.Services;

[Collection("SQLiteDatabase")]
public sealed class IdsMustMatchGroupValidationTests : SqliteTestBase
{
    public IdsMustMatchGroupValidationTests() : base("jobsearchassistant-ids-must-match-tests")
    {
    }

    [Fact]
    public async Task FullUpdate_ChildAndForeignKey_WithMatchingIds_Passes()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Matching Ids",
            JobTitle = "Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Matching ids document",
                Type = DocumentType.Markdown,
                Content = "Original content",
                Source = "ids-must-match-tests"
            }
        });
        Assert.NotNull(created);

        var updated = await new Resumes().FullUpdate(created.Id, new Resume
        {
            Id = created.Id,
            Name = "Matching Ids Updated",
            JobTitle = "Senior Engineer",
            Date = DateTimeOffset.UtcNow,
            DocumentId = created.DocumentId,
            Document = new Document
            {
                Id = created.DocumentId,
                Title = "Matching ids document",
                Type = DocumentType.Markdown,
                Content = "Updated content",
                Source = "ids-must-match-tests"
            }
        });

        Assert.NotNull(updated);
        Assert.Equal("Matching Ids Updated", updated!.Name);
    }

    [Fact]
    public async Task FullUpdate_ChildAndForeignKey_WithMismatchedIds_Fails()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Mismatched Ids",
            JobTitle = "Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Mismatched ids document",
                Type = DocumentType.Markdown,
                Content = "Original content",
                Source = "ids-must-match-tests"
            }
        });
        Assert.NotNull(created);

        var otherDocument = await new Documents().Create(new Document
        {
            Title = "A different document",
            Type = DocumentType.Text,
            Content = "Unrelated content",
            Source = "ids-must-match-tests"
        });
        Assert.NotNull(otherDocument);

        var ex = await Assert.ThrowsAsync<ValidationException>(() => new Resumes().FullUpdate(created.Id, new Resume
        {
            Id = created.Id,
            Name = "Mismatched Ids Updated",
            JobTitle = "Senior Engineer",
            Date = DateTimeOffset.UtcNow,
            DocumentId = created.DocumentId,
            Document = new Document
            {
                Id = otherDocument!.Id,
                Title = "A different document",
                Type = DocumentType.Text,
                Content = "Unrelated content",
                Source = "ids-must-match-tests"
            }
        }));

        Assert.Contains("does not match", ex.Message);
    }

    [Fact]
    public async Task FullUpdate_OnlyForeignKeyIdProvided_Passes()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Only Foreign Key",
            JobTitle = "Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Only foreign key document",
                Type = DocumentType.Markdown,
                Content = "Original content",
                Source = "ids-must-match-tests"
            }
        });
        Assert.NotNull(created);

        var updated = await new Resumes().FullUpdate(created.Id, new Resume
        {
            Id = created.Id,
            Name = "Only Foreign Key Updated",
            JobTitle = "Senior Engineer",
            Date = DateTimeOffset.UtcNow,
            DocumentId = created.DocumentId,
        });

        Assert.NotNull(updated);
        Assert.Equal("Only Foreign Key Updated", updated!.Name);
        Assert.Equal(created.DocumentId, updated.DocumentId);
    }

    [Fact]
    public async Task Patch_ChildAndForeignKey_WithMismatchedIds_Fails()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Patch Mismatched Ids",
            JobTitle = "Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Patch mismatched ids document",
                Type = DocumentType.Markdown,
                Content = "Original content",
                Source = "ids-must-match-tests"
            }
        });
        Assert.NotNull(created);

        var otherDocument = await new Documents().Create(new Document
        {
            Title = "Another document",
            Type = DocumentType.Text,
            Content = "Unrelated content",
            Source = "ids-must-match-tests"
        });
        Assert.NotNull(otherDocument);

        var patchFields = new Dictionary<string, object?>
        {
            ["documentId"] = created.DocumentId,
            ["document"] = JsonDocument.Parse($"{{\"id\": {otherDocument!.Id}}}").RootElement,
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(() => new Resumes().PartialUpdate(created.Id, patchFields));

        Assert.Contains("does not match", ex.Message);
    }

    [Fact]
    public async Task Patch_ChildAndForeignKey_WithMatchingIds_Passes()
    {
        RunMigrations();

        var created = await new Resumes().Create(new Resume
        {
            Name = "Patch Matching Ids",
            JobTitle = "Engineer",
            Date = DateTimeOffset.UtcNow,
            Document = new Document
            {
                Title = "Patch matching ids document",
                Type = DocumentType.Markdown,
                Content = "Original content",
                Source = "ids-must-match-tests"
            }
        });
        Assert.NotNull(created);

        var patchFields = new Dictionary<string, object?>
        {
            ["name"] = "Patch Matching Ids Updated",
            ["documentId"] = created.DocumentId,
            ["document"] = JsonDocument.Parse($"{{\"id\": {created.DocumentId}, \"title\": \"Patch matching ids document\"}}").RootElement,
        };

        var patched = await new Resumes().PartialUpdate(created.Id, patchFields);

        Assert.NotNull(patched);
        Assert.Equal("Patch Matching Ids Updated", patched!.Name);
    }
}
