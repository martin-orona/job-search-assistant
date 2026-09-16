namespace JobSearchAssistant.Server;

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using Dapper;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Data.Sqlite;

using JobSearchAssistant.DB;

using JobSearchAssistant.Core;
using JobSearchAssistant.DB.Models;
using JobSearchAssistant.DB.Services;

public class BaseController<T> where T : Model
{
    public BaseController(ModelCrud<T> db, string groupName, Dictionary<string, string> routeNames)
    {
        this.DB = db;
        this.GroupName = groupName;

        foreach (var route in routeNames)
        {
            this.RouteNames[route.Key] = route.Value;
        }
    }

    public ModelCrud<T> DB { get; protected set; }

    public string GroupName { get; protected set; }

    public Dictionary<string, string> RouteNames { get; } = new Dictionary<string, string>();

    public virtual RouteGroupBuilder Map(RouteGroupBuilder parent)
    {
        var group = parent.MapGroup($"/{this.GroupName}");
        group.MapGet("/", this.GetAll);
        group.MapGet("/{id:int}", this.GetById).WithName(this.RouteNames["GetById"]);
        group.MapPost("/", (Delegate)this.Create);
        group.MapPut("/{id:int}", this.Update);
        group.MapPatch("/{id:int}", this.Patch);
        group.MapDelete("/{id:int}", (int id, HttpContext context) => this.Delete(id, context));
        return group;
    }

    public async Task<IResult> GetAll([Microsoft.AspNetCore.Mvc.FromQuery] bool deep = false) => await Controller.GetAll<T>(this.DB, deep);

    public async Task<IResult> GetById(int id, [Microsoft.AspNetCore.Mvc.FromQuery] bool deep = false) => await Controller.GetById<T>(id, this.DB, deep);

    public async Task<IResult> Create(HttpContext context) => await Controller.Create<T>(context, this.RouteNames["GetById"], this.DB);

    public async Task<IResult> Update(int id, HttpContext context) => await Controller.Update<T>(id, context, this.DB);

    public async Task<IResult> Patch(int id, HttpContext context) => await Controller.Patch<T>(id, context, this.DB);

    public async Task<IResult> Delete(int id) => await Controller.Delete<T>(id, this.DB);

    public async Task<IResult> Delete(int id, HttpContext context) => await Controller.Delete<T>(id, context, this.DB);
}

public class Controller
{
    public static async Task<IResult> GetAll<T>(ModelCrud<T> db, bool deep = false) where T : Model
    {
        var records = await db.GetAll(deep);
        return TypedResults.Ok(records);
    }

    public static async Task<IResult> GetById<T>(int id, ModelCrud<T> db, bool deep = false) where T : Model
    {
        var record = await db.GetById(id, deep);

        if (record == null)
        {
            return Results.NotFound();
        }

        return TypedResults.Ok(record);
    }

    // public static async Task<IResult> GetById<T>(int id, ModelCrud<T> db, SqliteConnection connection) where T : Model
    // {
    //     var record = await db.GetById(id, connection);
    //     if (record == null)
    //     {
    //         return Results.NotFound();
    //     }
    //     return TypedResults.Ok(record);
    // }

    public static async Task<IResult> Create<T>(HttpContext context, string routeName, ModelCrud<T> db) where T : Model
    {
        var (success, input, failure) = await ParsePayload<T>(context);
        if (!success)
        {
            return failure!;
        }

        var created = await db.Create(input!);
        if (created == null)
        {
            return Results.BadRequest("Failed to create record.");
        }

        return TypedResults.CreatedAtRoute(created, routeName, new { id = created.Id });
    }

    // public static async Task<IResult> Create<T>(HttpContext context, string routeName, ModelWithDocumentCrud<T> db) where T : ModelWithDocument
    // {
    //     var (success, input, failure) = await ParsePayload<T>(context);
    //     if (!success)
    //     {
    //         return failure!;
    //     }
    //
    //     T? created;
    //
    //     try
    //     {
    //         created = await db.Create(input!);
    //         if (created == null)
    //         {
    //             return Results.BadRequest("Failed to create record.");
    //         }
    //     }
    //     catch (ValidationException ex)
    //     {
    //         return TypedResults.BadRequest(new { error = $"Validation failed. Reason: {ex.Message}", validationErrors = ex.ValidationErrors });
    //     }
    //     catch (Exception ex)
    //     {
    //         return TypedResults.BadRequest(new { error = $"Failed to create record. Reason: {ex.Message}" });
    //     }
    //
    //     return TypedResults.CreatedAtRoute(created, routeName, new { id = created.Id });
    // }

    public static async Task<IResult> Update<T>(int id, HttpContext context, ModelCrud<T> db) where T : Model
    {
        var (success, input, failure) = await ParsePayload<T>(context);
        if (!success)
        {
            return failure!;
        }

        var record = await db.FullUpdate(id, input!);
        if (record == null)
        {
            return Results.NotFound();
        }

        return TypedResults.Ok(record);
    }

    public static async Task<IResult> Patch<T>(int id, HttpContext context, ModelCrud<T> db) where T : Model
    {
        var (success, input, failure) = await ParsePayload<Dictionary<string, object?>>(context);
        if (!success)
        {
            return failure!;
        }

        try
        {
            var record = await db.PartialUpdate(id, input!);
            return TypedResults.Ok(record);
        }
        catch (Exception ex)
        {
            return TypedResults.BadRequest(new { error = $"Unable to patch record. Reason: {ex.Message}" });
        }
    }

    public static async Task<IResult> Delete<T>(int id, ModelCrud<T> db) where T : Model
    {
        return await Delete<T>(id, null, db);
    }

    public static async Task<IResult> Delete<T>(int id, HttpContext? context, ModelCrud<T> db) where T : Model
    {
        var include = await ParseDeleteRequestAsync(context);
        var rootEntityKey = GetEntityKeyForType(typeof(T));
        var attemptedEntityKey = rootEntityKey;
        SqliteConnection? connection = null;

        try
        {
            connection = Database.Connect();
            using var transaction = await connection.BeginTransactionAsync();

            await DeleteTargetAsync(rootEntityKey, id, connection);

            foreach (var item in include)
            {
                attemptedEntityKey = item.Entity;
                await DeleteTargetAsync(item.Entity, item.Id, connection);
            }

            await transaction.CommitAsync();

            return TypedResults.Ok(new { deleted = new[] { new { entity = rootEntityKey, id } }.Concat(include.Select(i => new { entity = i.Entity, id = i.Id })) });
        }
        catch (NotFoundException ex)
        {
            return Results.NotFound(new { error = ex.Message });
        }
        catch (SqliteException ex) when (IsForeignKeyFailure(ex))
        {
            var targetEntityKey = attemptedEntityKey;
            var targetLabel = GetUserFriendlyEntityName(targetEntityKey);
            var referencingLabel = GetReferencingEntityLabel(targetEntityKey);
            var errorMessage = await BuildForeignKeyDeleteMessage(rootEntityKey, targetEntityKey, targetLabel, id, connection, referencingLabel);
            return TypedResults.BadRequest(new
            {
                error = errorMessage,
                entity = targetEntityKey,
                referencedBy = referencingLabel,
            });
        }
        catch (ValidationException ex)
        {
            return TypedResults.BadRequest(new { error = $"Validation failed. Reason: {ex.Message}", validationErrors = ex.ValidationErrors });
        }
        catch (Exception ex)
        {
            return TypedResults.InternalServerError(new { error = $"Unable to delete record. Reason: {ex.Message}" });
        }
        finally
        {
            connection?.Dispose();
        }
    }

    private static async Task<string> BuildForeignKeyDeleteMessage(string rootEntityKey, string targetEntityKey, string targetLabel, int rootId, SqliteConnection? connection, string referencingLabel)
    {
        var referencingRecords = await GetReferencingDeleteRecordsAsync(targetEntityKey, rootId, connection);
        if (referencingRecords.Count > 0)
        {
            var distinctLabels = referencingRecords.Select(item => item.EntityLabel).Distinct().ToList();
            var placedList = string.Join(", ", referencingRecords.Select(item => $"{item.EntityLabel} {item.Id}"));
            var pluralizedLabel = distinctLabels.Count == 1 ? distinctLabels[0] : string.Join(" and ", distinctLabels);
            return $"The {targetLabel} record cannot be deleted because it is still referenced by {pluralizedLabel} records: {placedList}. Delete the {pluralizedLabel} records first and try again.";
        }

        if (rootEntityKey == "ai-prompts" && targetEntityKey == "job-postings")
        {
            var referencingIds = (await GetReferencingAiPromptIdsAsync(connection, rootId)).ToList();
            var referencingList = referencingIds.Count > 0
                ? $", {string.Join(", ", referencingIds.Select(id => $"AI Prompt {id}"))}"
                : string.Empty;

            return $"The AI Prompt record could not be deleted because it references a Job Posting that is still referenced by other AI Prompt records{referencingList}. Remove that reference(s), or do not select to delete the Job Posting, and try again.";
        }

        return $"The {targetLabel} record cannot be deleted because it is still referenced by {referencingLabel} records. Delete the {referencingLabel} records first and try again.";
    }

    private static async Task<List<(string EntityLabel, int Id)>> GetReferencingDeleteRecordsAsync(string targetEntityKey, int targetId, SqliteConnection? connection)
    {
        if (connection == null || targetId <= 0)
        {
            return new List<(string EntityLabel, int Id)>();
        }

        return targetEntityKey switch
        {
            "job-postings" => (await connection.QueryAsync<int>("select id from ai_prompt where job_posting_id = @TargetId order by id", new { TargetId = targetId }))
                .Select(id => ("AI Prompt", id))
                .Concat((await connection.QueryAsync<int>("select id from job_application where job_posting_id = @TargetId order by id", new { TargetId = targetId }))
                    .Select(id => ("Job Application", id)))
                .ToList(),
            "resumes" => (await connection.QueryAsync<int>("select id from ai_prompt where resume_id = @TargetId order by id", new { TargetId = targetId }))
                .Select(id => ("AI Prompt", id))
                .Concat((await connection.QueryAsync<int>("select id from job_application where resume_id = @TargetId order by id", new { TargetId = targetId }))
                    .Select(id => ("Job Application", id)))
                .ToList(),
            "ai-prompt-templates" => (await connection.QueryAsync<int>("select id from ai_prompt where ai_prompt_template_id = @TargetId order by id", new { TargetId = targetId }))
                .Select(id => ("AI Prompt", id))
                .ToList(),
            "job-applications" => (await connection.QueryAsync<int>("select id from job_question where job_application_id = @TargetId order by id", new { TargetId = targetId }))
                .Select(id => ("Job Question", id))
                .ToList(),
            "job-sources" => (await connection.QueryAsync<int>("select id from job_application where source_id = @TargetId order by id", new { TargetId = targetId }))
                .Select(id => ("Job Application", id))
                .ToList(),
            _ => new List<(string EntityLabel, int Id)>(),
        };
    }

    private static async Task<IEnumerable<int>> GetReferencingAiPromptIdsAsync(SqliteConnection? connection, int promptId)
    {
        if (connection == null || promptId <= 0)
        {
            return Enumerable.Empty<int>();
        }

        var jobPostingId = await connection.QuerySingleOrDefaultAsync<int?>(
            "select job_posting_id from ai_prompt where id = @PromptId",
            new { PromptId = promptId });

        if (jobPostingId is null or <= 0)
        {
            return Enumerable.Empty<int>();
        }

        return await connection.QueryAsync<int>(
            "select id from ai_prompt where job_posting_id = @JobPostingId and id != @PromptId order by id",
            new { JobPostingId = jobPostingId.Value, PromptId = promptId });
    }

    private static bool IsForeignKeyFailure(Microsoft.Data.Sqlite.SqliteException ex)
    {
        var message = ex.Message ?? string.Empty;
        return message.Contains("FOREIGN KEY", StringComparison.OrdinalIgnoreCase)
            || message.Contains("foreign key", StringComparison.OrdinalIgnoreCase)
            || message.Contains("constraint", StringComparison.OrdinalIgnoreCase)
            || message.Contains("REFERENCES", StringComparison.OrdinalIgnoreCase);
    }

    private static string GetEntityKeyForType(Type type)
    {
        if (type == typeof(JobPosting))
        {
            return "job-postings";
        }

        if (type == typeof(Resume))
        {
            return "resumes";
        }

        if (type == typeof(AiPromptTemplate))
        {
            return "ai-prompt-templates";
        }

        if (type == typeof(AiPrompt))
        {
            return "ai-prompts";
        }

        if (type == typeof(JobApplication))
        {
            return "job-applications";
        }

        if (type == typeof(JobSource))
        {
            return "job-sources";
        }

        if (type == typeof(JobQuestion))
        {
            return "job-questions";
        }

        if (type == typeof(Document))
        {
            return "documents";
        }

        return type.Name;
    }

    private static string GetUserFriendlyEntityName(string entityKey)
    {
        return entityKey switch
        {
            "job-postings" => "Job Posting",
            "resumes" => "Resume",
            "ai-prompt-templates" => "AI Prompt Template",
            "ai-prompts" => "AI Prompt",
            "job-applications" => "Job Application",
            "job-sources" => "Job Source",
            "job-questions" => "Job Question",
            "documents" => "Document",
            _ => entityKey,
        };
    }

    private static string GetReferencingEntityLabel(string entityKey)
    {
        return entityKey switch
        {
            "job-postings" => "AI Prompt",
            "resumes" => "AI Prompt",
            "ai-prompt-templates" => "AI Prompt",
            "job-applications" => "Job Question",
            "job-sources" => "Job Application",
            "job-questions" => "Job Application",
            "documents" => "Job Posting, Resume, AI Prompt Template, or AI Prompt",
            _ => "other",
        };
    }

    private static async Task<List<(string Entity, int Id)>> ParseDeleteRequestAsync(HttpContext? context)
    {
        if (context == null || context.Request.ContentLength is <= 0)
        {
            return new List<(string Entity, int Id)>();
        }

        try
        {
            var payload = await context.Request.ReadFromJsonAsync<DeleteRequestPayload>();
            if (payload?.Include == null)
            {
                return new List<(string Entity, int Id)>();
            }

            return payload.Include
                .Where(item => item != null && !string.IsNullOrWhiteSpace(item.Entity) && item.Id > 0)
                .Select(item => (NormalizeEntityKey(item.Entity!), item.Id))
                .Distinct()
                .ToList();
        }
        catch (System.Text.Json.JsonException)
        {
            return new List<(string Entity, int Id)>();
        }
    }

    private static string NormalizeEntityKey(string entity)
    {
        var normalized = entity.Trim();
        return normalized switch
        {
            "job-posting" => "job-postings",
            "job_posting" => "job-postings",
            "job-postings" => "job-postings",
            "job-application" => "job-applications",
            "job_application" => "job-applications",
            "job-applications" => "job-applications",
            "job-source" => "job-sources",
            "job_source" => "job-sources",
            "job-sources" => "job-sources",
            "job-question" => "job-questions",
            "job_question" => "job-questions",
            "job-questions" => "job-questions",
            "resume" => "resumes",
            "resumes" => "resumes",
            "ai-prompt-template" => "ai-prompt-templates",
            "ai_prompt_template" => "ai-prompt-templates",
            "ai-prompt-templates" => "ai-prompt-templates",
            "ai-prompt" => "ai-prompts",
            "ai_prompt" => "ai-prompts",
            "ai-prompts" => "ai-prompts",
            "document" => "documents",
            "documents" => "documents",
            _ => normalized,
        };
    }

    private static async Task DeleteTargetAsync(string entity, int id, SqliteConnection connection)
    {
        if (id <= 0)
        {
            return;
        }

        switch (entity)
        {
            case "job-postings":
                var jobPosting = await new JobSearchAssistant.DB.Services.JobPostings().Delete(id, connection);
                if (jobPosting == null)
                {
                    throw new NotFoundException($"Record [{id}] not found in [job-postings].");
                }
                break;
            case "job-applications":
                var jobApplication = await new JobSearchAssistant.DB.Services.JobApplications().Delete(id, connection);
                if (jobApplication == null)
                {
                    throw new NotFoundException($"Record [{id}] not found in [job-applications].");
                }
                break;
            case "job-sources":
                var jobSource = await new JobSearchAssistant.DB.Services.JobSources().Delete(id, connection);
                if (jobSource == null)
                {
                    throw new NotFoundException($"Record [{id}] not found in [job-sources].");
                }
                break;
            case "job-questions":
                var jobQuestion = await new JobSearchAssistant.DB.Services.JobQuestions().Delete(id, connection);
                if (jobQuestion == null)
                {
                    throw new NotFoundException($"Record [{id}] not found in [job-questions].");
                }
                break;
            case "resumes":
                var resume = await new JobSearchAssistant.DB.Services.Resumes().Delete(id, connection);
                if (resume == null)
                {
                    throw new NotFoundException($"Record [{id}] not found in [resumes].");
                }
                break;
            case "ai-prompt-templates":
                var template = await new JobSearchAssistant.DB.Services.AiPromptTemplates().Delete(id, connection);
                if (template == null)
                {
                    throw new NotFoundException($"Record [{id}] not found in [ai-prompt-templates].");
                }
                break;
            case "ai-prompts":
                var prompt = await new JobSearchAssistant.DB.Services.AiPrompts().Delete(id, connection);
                if (prompt == null)
                {
                    throw new NotFoundException($"Record [{id}] not found in [ai-prompts].");
                }
                break;
            case "documents":
                var document = await new JobSearchAssistant.DB.Services.Documents().Delete(id, connection);
                if (document == null)
                {
                    throw new NotFoundException($"Record [{id}] not found in [documents].");
                }
                break;
            default:
                throw new ValidationException($"Unsupported delete target [{entity}]", Array.Empty<ValidationError>());
        }
    }

    private sealed class DeleteRequestPayload
    {
        public List<DeleteRequestItem>? Include { get; set; }
    }

    private sealed class DeleteRequestItem
    {
        public string? Entity { get; set; }

        public int Id { get; set; }
    }

    // public static async Task<IResult> Delete<T>(int id, ModelCrud<T> db, SqliteConnection connection) where T : Model
    // {
    //     try
    //     {
    //         var record = await db.Delete(id, connection);
    //         return TypedResults.Ok(record);
    //     }
    //     catch (Exception ex)
    //     {
    //         return TypedResults.BadRequest(new { error = $"Unable to delete record. Reason: {ex.Message}" });
    //     }
    // }

    public static async Task<(bool success, T? parsed, IResult? failure)> ParsePayload<T>(HttpContext context)
    {
        try
        {
            var parsed = await context.Request.ReadFromJsonAsync<T>();
            if (parsed == null)
            {
                return (false, default, Results.BadRequest("Parsing payload failed."));
            }

            return (true, parsed, default);
        }
        catch (System.Text.Json.JsonException ex)
        {
            var failure = TypedResults.BadRequest(new
            {
                error = "Invalid JSON payload.",
                path = ex.Path,
                lineNumber = ex.LineNumber,
                bytePositionInLine = ex.BytePositionInLine,
            });
            return (false, default, failure);
        }
    }

}
