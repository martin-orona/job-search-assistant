using System.Text;

using Dapper;

using JobSearchAssistant.DB;
using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

using Microsoft.AspNetCore.Http;

namespace JobSearchAssistant.Server.Tests;

[Collection("SQLiteDatabase")]
public sealed class Documents_Controller_Tests : SqliteTestBase
{
    public Documents_Controller_Tests() : base("jobsearchassistant-documents-controller-tests")
    {
    }

    [Fact]
    public async Task Documents_GetById_ReturnsNotFound_WhenRecordDoesNotExist()
    {
        RunMigrations();

        var result = await new global::JobSearchAssistant.Server.Documents().GetById(404);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status404NotFound, context.Response.StatusCode);
    }

    [Fact]
    public async Task Documents_Update_ReturnsUpdatedDocument()
    {
        RunMigrations();

        var created = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = "Before update",
            Type = DocumentType.Markdown,
            Content = "Original content",
            Source = "update-source"
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new
        {
            title = "After update",
            type = (int)DocumentType.Text,
            content = "Updated content",
            source = "updated-source"
        });

        var result = await new global::JobSearchAssistant.Server.Documents().Update(created.Id, context);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);
        var updatedBody = await ReadResponseBodyAsync(response);
        Assert.Contains("After update", updatedBody);
        Assert.Contains("Updated content", updatedBody);

        using var connection = Database.Connect();
        var updated = await connection.QuerySingleAsync<string>(
            "select title from document where id = @Id",
            new { created.Id });

        Assert.Equal("After update", updated);
    }

    [Fact]
    public async Task Documents_Patch_UpdatesOnlyProvidedFields()
    {
        RunMigrations();

        var created = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = "Original title",
            Type = DocumentType.Markdown,
            Content = "Original content",
            Source = "patch-source"
        });
        Assert.NotNull(created);

        var context = CreateJsonHttpContext(new Dictionary<string, object?>
        {
            ["content"] = "Patched content",
            ["source"] = "patched-source"
        });

        var result = await new global::JobSearchAssistant.Server.Documents().Patch(created.Id, context);
        var response = CreateContext();
        await result.ExecuteAsync(response);

        Assert.Equal(StatusCodes.Status200OK, response.Response.StatusCode);

        var body = await ReadResponseBodyAsync(response);
        Assert.Contains("Original title", body);
        Assert.Contains("Patched content", body);
        Assert.Contains("patched-source", body);

        using var connection = Database.Connect();
        var patched = await connection.QuerySingleAsync<string>(
            "select content from document where id = @Id",
            new { created.Id });

        Assert.Equal("Patched content", patched);
    }

    [Fact]
    public async Task Documents_Delete_RemovesRecord()
    {
        RunMigrations();

        var created = await new global::JobSearchAssistant.DB.Services.Documents().Create(new Document
        {
            Title = "Delete me",
            Type = DocumentType.Other,
            Content = "Will be deleted",
            Source = "delete-source"
        });
        Assert.NotNull(created);

        var result = await new global::JobSearchAssistant.Server.Documents().Delete(created.Id);
        var context = CreateContext();
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);

        using var connection = Database.Connect();
        var remaining = await connection.QuerySingleOrDefaultAsync<int?>(
            "select id from document where id = @Id",
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
