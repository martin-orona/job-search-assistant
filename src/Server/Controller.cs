namespace JobSearchAssistant.Server;

using System;
using System.Collections.Generic;
using System.Threading.Tasks;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

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
        group.MapDelete("/{id:int}", this.Delete);
        return group;
    }

    public async Task<IResult> GetAll() => await Controller.GetAll<T>(this.DB);

    public async Task<IResult> GetById(int id) => await Controller.GetById<T>(id, this.DB);

    public async Task<IResult> Create(HttpContext context) => await Controller.Create<T>(context, this.RouteNames["GetById"], this.DB);

    public async Task<IResult> Update(int id, HttpContext context) => await Controller.Update<T>(id, context, this.DB);

    public async Task<IResult> Patch(int id, HttpContext context) => await Controller.Patch<T>(id, context, this.DB);

    public async Task<IResult> Delete(int id) => await Controller.Delete<T>(id, this.DB);
}

public class Controller
{
    public static async Task<IResult> GetAll<T>(ModelCrud<T> db) where T : Model
    {
        var records = await db.GetAll();
        return TypedResults.Ok(records);
    }

    public static async Task<IResult> GetById<T>(int id, ModelCrud<T> db) where T : Model
    {
        var record = await db.GetById(id);

        if (record == null)
        {
            return Results.NotFound();
        }

        return TypedResults.Ok(record);
    }

    // public static async Task<IResult> GetById<T>(int id, ModelCrud<T> db, SqliteConnection connection) where T : Model
    // {
    //     var record = await db.GetById(id, connection);
    //
    //     if (record == null)
    //     {
    //         return Results.NotFound();
    //     }
    //
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
        try
        {
            var record = await db.Delete(id);
            if (record == null)
            {
                return Results.NotFound();
            }

            return TypedResults.Ok(record);
        }
        catch (NotFoundException ex)
        {
            return Results.NotFound(new { error = ex.Message });
        }
        catch (ValidationException ex)
        {
            return TypedResults.BadRequest(new { error = $"Validation failed. Reason: {ex.Message}", validationErrors = ex.ValidationErrors });
        }
        catch (Exception ex)
        {
            return TypedResults.InternalServerError(new { error = $"Unable to delete record. Reason: {ex.Message}" });
        }
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
