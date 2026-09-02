using Dapper;

using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

namespace JobSearchAssistant.DB.Tests;

[Collection("SQLiteDatabase")]
public sealed class resume_table_Tests : SqliteTestBase
{
    public resume_table_Tests() : base("jobsearchassistant-resume-tests")
    {
    }

    [Fact]
    public void RunMigrations_CreatesExpectedTables()
    {
        RunMigrations();

        using var connection = Database.Connect();

        var tableCount = connection.QuerySingle<int>(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'resume';");

        Assert.Equal(1, tableCount);
    }

    [Fact]
    public async Task Resume_CreateAndGetById_RoundTripsData()
    {
        RunMigrations();

        var document = await new Documents().Create(new Document
        {
            Title = "Resume source document",
            Type = DocumentType.Markdown,
            Content = "This is the resume source content.",
            Source = "resume-test"
        });

        Assert.NotNull(document);

        using var connection = Database.Connect();

        var insertedId = await connection.QuerySingleAsync<int>(
            @"insert into resume (name, job_title, date, document_id)
              values (@Name, @JobTitle, @Date, @DocumentId)
              returning id",
            new
            {
                Name = "Ada Lovelace",
                JobTitle = "Senior Software Engineer",
                Date = DateTimeOffset.UtcNow,
                DocumentId = document.Id
            });

        var row = await connection.QuerySingleAsync<dynamic>(
            "select name, job_title, document_id from resume where id = @Id",
            new { Id = insertedId });

        Assert.Equal("Ada Lovelace", (string)row.name);
        Assert.Equal("Senior Software Engineer", (string)row.job_title);
        Assert.Equal(document.Id, (long)row.document_id);
    }

    [Fact]
    public async Task Updating_resume_updates_updatedat_via_trigger()
    {
        RunMigrations();

        var document = await new Documents().Create(new Document
        {
            Title = "Resume trigger document",
            Type = DocumentType.Text,
            Content = "For update trigger validation.",
            Source = "trigger-test"
        });

        Assert.NotNull(document);

        using var connection = Database.Connect();

        var insertedId = await connection.QuerySingleAsync<int>(
            @"insert into resume (name, job_title, date, document_id)
              values (@Name, @JobTitle, @Date, @DocumentId)
              returning id",
            new
            {
                Name = "Grace Hopper",
                JobTitle = "Principal Engineer",
                Date = DateTimeOffset.UtcNow,
                DocumentId = document.Id
            });

        var originalUpdatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from resume where id = @Id",
            new { Id = insertedId });

        await Task.Delay(1100);

        await connection.ExecuteAsync(
            "update resume set job_title = @JobTitle where id = @Id",
            new { JobTitle = "Director of Engineering", Id = insertedId });

        var updatedAt = await connection.QuerySingleAsync<DateTime>(
            "select updated_at from resume where id = @Id",
            new { Id = insertedId });

        Assert.True(updatedAt > originalUpdatedAt,
            $"Expected updated_at to change after update. Original: {originalUpdatedAt:o}, Updated: {updatedAt:o}");
    }

    [Fact]
    public async Task Resume_fts_index_is_created_and_searches_name_and_job_title()
    {
        RunMigrations();

        var document = await new Documents().Create(new Document
        {
            Title = "Resume search document",
            Type = DocumentType.Markdown,
            Content = "Candidate profile for a distributed systems engineer role.",
            Source = "resume-fts"
        });
        Assert.NotNull(document);

        using var connection = Database.Connect();

        await connection.ExecuteAsync(
            @"insert into resume (name, job_title, date, document_id)
              values (@Name, @JobTitle, @Date, @DocumentId)",
            new
            {
                Name = "Margaret Hamilton",
                JobTitle = "Distributed Systems Engineer",
                Date = DateTimeOffset.UtcNow,
                DocumentId = document.Id
            });

        var nameMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from resume_fts_index where name match 'hamilton' ");

        var jobTitleMatches = await connection.QuerySingleAsync<int>(
            "select count(*) from resume_fts_index where job_title match 'engineer' ");

        Assert.Equal(1, nameMatches);
        Assert.Equal(1, jobTitleMatches);
    }
}
