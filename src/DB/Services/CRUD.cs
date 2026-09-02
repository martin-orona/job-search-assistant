namespace JobSearchAssistant.DB.Services;

using System.Collections.Frozen;
using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Reflection;
using System.Text.Json;

using Dapper;

using JobSearchAssistant.Core;
using JobSearchAssistant.DB.Models;

using Microsoft.Data.Sqlite;

// TODO: Clean this up. With the addition of the ability to dynamically save and update models with other models as their properties, there is probably no need for separate CRUD classes for models with documents.
public class ModelCrud<T> where T : Model
{
    public ModelCrud(string tableName)
    {
        var crudInfo = CRUD.RegisterCrudInfo<T>(tableName);
    }

    public string TableName => CRUD.CrudInfo[typeof(T)].TableName;

    public FrozenDictionary<string, PropertyInfo> ValidProperties => CRUD.CrudInfo[typeof(T)].ValidProperties;

    public IReadOnlyList<string> InsertFields => CRUD.CrudInfo[typeof(T)].InsertFields;

    public IReadOnlyList<string> InsertValues => CRUD.CrudInfo[typeof(T)].InsertValues;

    public IReadOnlyList<string> FullUpdateSetProperties => CRUD.CrudInfo[typeof(T)].FullUpdateSetProperties;

    internal static IReadOnlyList<ValidationError> NoValidationErrors => new List<ValidationError>();

    public virtual async Task<T?> Create(T values) => await CRUD.Create(values);

    public virtual async Task<T?> Create(T values, SqliteConnection connection) => await CRUD.Create(values, connection);

    public virtual async Task<IReadOnlyList<T>> GetAll() => await this.GetAll(null);

    public virtual async Task<IReadOnlyList<T>> GetAll(QueryOptions? options) => await CRUD.GetAll<T>(this.TableName, options);

    public virtual async Task<T?> GetById(int id) => await CRUD.GetById<T>(this.TableName, id);

    public virtual async Task<T?> GetById(int id, SqliteConnection connection) => await CRUD.GetById<T>(this.TableName, id, connection);

    public virtual async Task<T?> FullUpdate(int id, T data) => await CRUD.FullUpdate(id, data);

    public virtual async Task<T?> FullUpdate(int id, T data, SqliteConnection connection) => await CRUD.FullUpdate<T>(id, data, connection);

    public virtual async Task<T?> PartialUpdate(int id, Dictionary<string, object?> patchFields) => await CRUD.PartialUpdate<T>(id, patchFields);

    public virtual async Task<T?> PartialUpdate(int id, Dictionary<string, object?> patchFields, SqliteConnection connection) => await CRUD.PartialUpdate<T>(id, patchFields, connection);

    public virtual async Task<T?> Delete(int id) => await CRUD.Delete<T>(this.TableName, id);

    public virtual async Task<T?> Delete(int id, SqliteConnection connection) => await CRUD.Delete<T>(this.TableName, id, connection);

    protected virtual IReadOnlyList<ValidationError> ValidateInput(T data) => NoValidationErrors;
}

public class ModelWithDocumentCrud<T> : ModelCrud<T> where T : ModelWithDocument
{
    public ModelWithDocumentCrud(string tableName) : base(tableName)
    {
    }

    public override async Task<T?> Create(T data) => await CRUD.Create(data);

    public override async Task<IReadOnlyList<T>> GetAll() => await CRUD.GetAll_WithDocument<T>(this.TableName, null);

    public override async Task<IReadOnlyList<T>> GetAll(QueryOptions? options) => await CRUD.GetAll_WithDocument<T>(this.TableName, options);

    public override async Task<T?> GetById(int id) => await CRUD.GetById_WithDocument<T>(this.TableName, id);

    public override async Task<T?> GetById(int id, SqliteConnection connection) => await CRUD.GetById_WithDocument<T>(this.TableName, id, connection);

    public override async Task<T?> Delete(int id) => await CRUD.Delete_WithDocument<T>(this.TableName, id);
}

public class CRUD
{
    internal const string DocumentTableName = Documents.DbTableName;

    internal static Dictionary<Type, CrudGeneratorInfo> CrudInfo => CrudInfoGeneration.CrudInfo;

    internal static void RegisterCrudServices()
    {
        System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof(Documents).TypeHandle);
        System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof(JobPostings).TypeHandle);
        System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof(Resumes).TypeHandle);
        System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof(AiPrompts).TypeHandle);
        System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(typeof(AiPromptTemplates).TypeHandle);
    }

    internal static CrudGeneratorInfo RegisterCrudInfo<T>(string tableName) where T : Model
    {
        var modelType = typeof(T);
        if (!CrudInfo.ContainsKey(modelType))
        {
            CrudInfo[modelType] = CrudInfoGeneration.GenerateCrudInfo<T>(tableName);
        }

        return CrudInfo[modelType];
    }

    // internal static async Task<T?> Create<T>(string tableName, IReadOnlyList<string> insertFieldList, IReadOnlyList<string> insertValueList, T data) where T : Model
    // {
    //     if (data == null)
    //     {
    //         return default;
    //     }

    //     using var connection = Database.Connect();
    //     var record = await Create(tableName, insertFieldList, insertValueList, data, connection);
    //     return record;
    // }

    // internal static async Task<T?> Create<T>(string tableName, IReadOnlyList<string> insertFieldList, IReadOnlyList<string> insertValueList, T data, SqliteConnection connection) where T : Model
    // {
    //     if (data == null)
    //     {
    //         return default;
    //     }

    //     var sql = QueryBuilder.BuildInsert(tableName, insertFieldList, insertValueList);
    //     var record = await connection.QueryFirstOrDefaultAsync<T>(sql, BuildModelParameters(data));
    //     return record;
    // }

    internal static async Task<T?> Create<T>(T data) where T : Model
    {
        using var connection = Database.Connect();
        var record = await Create(data, connection);
        return record;
    }

    internal static async Task<T?> Create<T>(T data, SqliteConnection connection) where T : Model
    {
        var tableName = CrudInfo[typeof(T)].TableName;

        using var transaction = await connection.BeginTransactionAsync();
        try
        {
            var record = await CreateModel<T>(data, connection, transaction, path: string.Empty);

            if (record == null)
            {
                throw new DatabaseException($"Unable to create new [{tableName}] record. Unknown reason.");
            }

            await transaction.CommitAsync();
            return record;
        }
        catch (Core.ValidationException ex)
        {
            await transaction.RollbackAsync();
            throw new Core.ValidationException($"Validation error(s) found while creating a new [{tableName}] record.", ex.ValidationErrors, ex);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            throw new DatabaseException($"An error occurred while creating a new [{tableName}] record. Reason: [{ex.Message}]", ex);
        }
    }

    internal static async Task<T?> CreateModel<T>(T data, SqliteConnection connection, System.Data.Common.DbTransaction transaction, string path = "") where T : Model
    {
        var (_, errors) = CrudValidator.ValidateForCreate(data, path);
        if (errors.Count > 0)
        {
            throw new Core.ValidationException("Validation failed.", errors);
        }

        // nested children are caught earlier by the create-path group rule; this is the backstop for the root model, which no group rule covers
        if (data.Id != 0)
        {
            throw new Core.ValidationException($"Model [{typeof(T).Name}] with ID [{data.Id}] has already been created.", new List<ValidationError>(new[] { new ValidationError { Field = "Id", Message = "Model has already been created." } }));
        }

        var modelProperties = await CreateModelProperties<T>(data, connection, transaction, path);

        // assign the newly created child model properties to the parent model so that when the parent is saved, it is built up properly
        AssignModelProperties(data, modelProperties);

        var tableName = CrudInfo[typeof(T)].TableName;
        var insertFieldList = CrudInfo[typeof(T)].InsertFields;
        var insertValueList = CrudInfo[typeof(T)].InsertValues;

        try
        {
            var sql = QueryBuilder.BuildInsert(tableName, insertFieldList, insertValueList);
            var record = await connection.QueryFirstOrDefaultAsync<T>(sql, BuildModelParameters(data));

            if (record == null)
            {
                throw new DatabaseException($"New [{tableName}] record was not created. Unknown reason.");
            }

            // assign the newly created child model properties for response
            AssignModelProperties(record, modelProperties);

            return record;
        }
        catch (Exception ex)
        {
            throw new DatabaseException($"An error occurred while creating a new [{tableName}] record. Reason: [{ex.Message}]", ex);
        }
    }

    internal static async Task<Dictionary<PropertyInfo, Model>> CreateModelProperties<T>(T data, SqliteConnection connection, System.Data.Common.DbTransaction transaction, string path = "") where T : Model
    {
        var modelValues = new Dictionary<PropertyInfo, Model>();

        var modelProperties = CrudInfoGeneration.GetCrudInfo<T>().ModelProperties;

        foreach (var property in modelProperties)
        {
            var currentPath = string.IsNullOrEmpty(path) ? property.Name : $"{path}.{property.Name}";

            if (property.GetValue(data) is not Model value)
            {
                // a null nested model is the "link to an existing record" path; the foreign key id carries the link
                if (HasForeignKeyId(data, property))
                {
                    continue;
                }

                throw new Core.ValidationException($"Nested model property [{currentPath}] cannot be null.", new List<ValidationError>());
            }

            var updatedSubModel = await ExecuteGenericMethod(nameof(CreateModel), property.PropertyType, [value, connection, transaction, currentPath]);

            if (updatedSubModel == null)
            {
                throw new Core.DatabaseException($"Nested model property [{currentPath}] could not be created. Unknown reason.");
            }

            modelValues[property] = updatedSubModel;
        }

        return modelValues;
    }

    // a foreign key id left at its default was never supplied, so it cannot stand in for a missing nested model
    internal static bool HasForeignKeyId<T>(T data, PropertyInfo modelProperty) where T : Model
    {
        var idProperty = typeof(T).GetProperty($"{modelProperty.Name}Id", BindingFlags.Public | BindingFlags.Instance);
        return idProperty != null && CrudValidator.HasProvidedValue(idProperty, data);
    }

    // every created child is keyed by its property here, so the foreign key backfill happens exactly once
    internal static void AssignModelProperties<T>(T record, Dictionary<PropertyInfo, Model> modelProperties) where T : Model
    {
        foreach (var kvp in modelProperties)
        {
            // Set the updated sub-model value on the main record
            kvp.Key.SetValue(record, kvp.Value);

            // if the main record has a sub-model id property, update it as well
            var subModelIdProperty = record.GetType().GetProperty($"{kvp.Key.Name}Id");
            if (subModelIdProperty != null)
            {
                var subModelId = kvp.Value.GetType().GetProperty("Id")?.GetValue(kvp.Value);
                subModelIdProperty.SetValue(record, subModelId);
            }
        }
    }

    // internal static async Task<T?> Create_WithDocument<T>(string tableName, IReadOnlyList<string> insertFieldList, IReadOnlyList<string> insertValueList, Func<T, IReadOnlyList<ValidationError>> validateInput, T data) where T : ModelWithDocument
    // {
    //     if (data == null)
    //     {
    //         throw new BadRequestException("Data cannot be null.");
    //     }

    //     (bool _, List<ValidationError> errors) = ValidateFull<T>(data);
    //     if (errors.Count > 0)
    //     {
    //         throw new Core.ValidationException("Validation failed.", errors);
    //     }

    //     // start a transaction
    //     using var connection = Database.Connect();
    //     using var transaction = await connection.BeginTransactionAsync();

    //     try
    //     {
    //         // create a document
    //         var docService = new Documents();
    //         var document = await docService.Create(data!.Document, connection);
    //         if (document == null)
    //         {
    //             throw new DatabaseException("Failed to create the document.");
    //         }

    //         data.DocumentId = document.Id;

    //         // create a resume record linked to the document
    //         var created = await CRUD.Create<T>(tableName, insertFieldList, insertValueList, data, connection);
    //         if (created == null)
    //         {
    //             throw new DatabaseException("Failed to create the record.");
    //         }

    //         await transaction.CommitAsync();

    //         created.Document = document;
    //         return created;
    //     }
    //     catch (Core.ValidationException ex)
    //     {
    //         await transaction.RollbackAsync();
    //         throw new Core.ValidationException($"An error occurred while creating a new [{tableName}] record. Reason: [{ex.Message}]", ex.ValidationErrors, ex);
    //     }
    //     catch (Exception ex)
    //     {
    //         await transaction.RollbackAsync();
    //         throw new DatabaseException($"An error occurred while creating a new [{tableName}] record. Reason: [{ex.Message}]", ex);
    //     }
    // }

    internal static async Task<IReadOnlyList<T>> GetAll<T>(string tableName, QueryOptions? options) where T : Model
    {
        using var connection = Database.Connect();
        var sql = QueryBuilder.BuildSelectAll(tableName, options);
        var records = await connection.QueryAsync<T>(sql);
        return records.ToList();
    }

    /* public override async Task<IReadOnlyList<Resume>> GetAll(QueryOptions? options)
    // {
    //     using var connection = Database.Connect();
    //     var sql = QueryBuilder.BuildSelectAllWithJoins(
    //         ("resume", "r"),
    //         [("document", "d", "d.id = r.document_id")],
    //         options);
    //     var records = await connection.QueryAsync<Resume, Document, Resume>(
    //         sql,
    //         (resume, document) => { resume.Document = document; return resume; },
    //         splitOn: "id");
    //     return records.ToList();
    // } */

    internal static async Task<IReadOnlyList<T>> GetAll_WithDocument<T>(string tableName, QueryOptions? options) where T : ModelWithDocument
    {
        using var connection = Database.Connect();
        var sql = QueryBuilder.BuildSelectAll(tableName, options);
        var records = await connection.QueryAsync<T>(sql);

        foreach (var record in records)
        {
            var document = await connection.QuerySingleOrDefaultAsync<Document>(
                "select * from document where id = @DocumentId",
                new { DocumentId = record.DocumentId });
            record.Document = document ?? new Document();
        }

        return records.ToList();
    }

    internal static async Task<T?> GetById_WithDocument<T>(string tableName, int id) where T : ModelWithDocument
    {
        using var connection = Database.Connect();
        return await GetById_WithDocument<T>(tableName, id, connection);
    }

    internal static async Task<T?> GetById_WithDocument<T>(string tableName, int id, SqliteConnection connection) where T : ModelWithDocument
    {
        var sql = QueryBuilder.BuildSelectById(tableName);
        var record = await connection.QuerySingleOrDefaultAsync<T>(sql, new { id });
        if (record == null)
        {
            return null;
        }

        var document = await connection.QuerySingleOrDefaultAsync<Document>(
            "select * from document where id = @DocumentId",
            new { DocumentId = record.DocumentId });
        record.Document = document ?? new Document();
        return record;
    }

    internal static async Task<T?> GetById<T>(string tableName, int id) where T : Model
    {
        using var connection = Database.Connect();
        return await GetById<T>(tableName, id, connection);
    }

    internal static async Task<T?> GetById<T>(string tableName, int id, SqliteConnection connection) where T : Model
    {
        var sql = QueryBuilder.BuildSelectById(tableName);
        var record = await connection.QueryFirstOrDefaultAsync<T>(sql, new { id });
        return record;
    }

    internal static async Task<T?> FullUpdate<T>(int id, T data) where T : Model
    {
        using var connection = Database.Connect();
        var record = await FullUpdate<T>(id, data, connection);
        return record;
    }

    internal static async Task<T?> FullUpdate<T>(int id, T data, SqliteConnection connection) where T : Model
    {
        using var transaction = await connection.BeginTransactionAsync();
        try
        {
            var tableName = CrudInfo[typeof(T)].TableName;
            var record = await FullModelUpdate<T>(id, data, connection, transaction, path: string.Empty);

            if (record == null)
            {
                throw new DatabaseException($"[{tableName}] record [{id}] was not updated. Unknown reason.");
            }

            await transaction.CommitAsync();
            return record;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    internal static async Task<T?> FullModelUpdate<T>(int id, T data, SqliteConnection connection, System.Data.Common.DbTransaction transaction, string path = "") where T : Model
    {
        var (_, errors) = CrudValidator.ValidateForUpdate(data, path);

        // a record can only be updated by a valid, already-assigned id
        if (id <= 0)
        {
            var idPath = string.IsNullOrEmpty(path) ? "Id" : $"{path}.Id";
            errors.Add(new ValidationError
            {
                Field = idPath,
                Message = $"Field [{idPath}] has invalid value [{id}]. Record IDs must be greater than 0.",
            });
        }

        if (errors.Count > 0)
        {
            throw new Core.ValidationException("Validation failed.", errors);
        }

        data.Id = id;

        var modelValues = new Dictionary<PropertyInfo, Model>();
        var modelProperties = CrudInfoGeneration.GetCrudInfo<T>().ModelProperties;
        if (modelProperties.Count > 0)
        {
            foreach (var property in modelProperties)
            {
                var currentPath = string.IsNullOrEmpty(path) ? property.Name : $"{path}.{property.Name}";

                if (property.GetValue(data) is not Model value)
                {
                    // a null nested model on update means the existing foreign key link is left untouched
                    if (HasForeignKeyId(data, property))
                    {
                        continue;
                    }

                    throw new Core.ValidationException($"Nested model property [{currentPath}] cannot be null.", new List<ValidationError>());
                }

                // var updatedValue = await ExecuteFullModelUpdate(property.PropertyType, value.Id, value, connection, transaction, currentPath);
                var updatedSubModel = await ExecuteGenericMethod(nameof(FullModelUpdate), property.PropertyType, [value.Id, value, connection, transaction, currentPath]);
                if (updatedSubModel == null)
                {
                    throw new Core.DatabaseException($"Nested model property [{currentPath}] could not be updated.");
                }

                modelValues[property] = updatedSubModel;
            }
        }

        var tableName = CrudInfo[typeof(T)].TableName;
        var propertySetList = CrudInfo[typeof(T)].FullUpdateSetProperties;

        try
        {
            var sql = QueryBuilder.BuildUpdate(tableName, propertySetList);
            var record = await connection.QueryFirstOrDefaultAsync<T>(sql, BuildModelParameters(data));

            if (record == null)
            {
                throw new DatabaseException($"[{tableName}] record [{id}] was not updated. Unknown reason.");
            }

            if (modelValues.Count > 0)
            {
                foreach (var kvp in modelValues)
                {
                    var property = kvp.Key;
                    var value = kvp.Value;
                    property.SetValue(record, value);
                }
            }

            return record;
        }
        catch (Exception ex)
        {
            throw new AppException($"Unable to update [{tableName}] record [{id}]. Reason: {ex.Message}", ex);
        }
    }

    internal static async Task<Model?> ExecuteFullModelUpdate(Type modelType, int id, Model data, SqliteConnection connection, System.Data.Common.DbTransaction transaction, string path) => await ExecuteGenericMethod(nameof(FullModelUpdate), modelType, [id, data, connection, transaction, path]);

    internal static async Task<T?> PartialUpdate<T>(int id, Dictionary<string, object?> patchFields) where T : Model
    {
        using var connection = Database.Connect();
        var record = await PartialUpdate<T>(id, patchFields, connection);
        return record;
    }

    internal static async Task<T?> PartialUpdate<T>(int id, Dictionary<string, object?> patchFields, SqliteConnection connection) where T : Model
    {
        using var transaction = connection.BeginTransaction();
        var tableName = CrudInfo[typeof(T)].TableName;
        try
        {
            var record = await PartialModelUpdate<T>(id, patchFields, connection, transaction, path: string.Empty);
            if (record == null)
            {
                throw new DatabaseException($"[{tableName}] record [{id}] was not updated. Unknown reason.");
            }

            await transaction.CommitAsync();
            return record;
        }
        catch (Core.ValidationException ex)
        {
            await transaction.RollbackAsync();
            throw new Core.ValidationException($"An error occurred during partial update of the [{tableName}] record. Reason: [{ex.Message}]", ex.ValidationErrors, ex);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            throw new AppException($"Unable to partially update [{tableName}] record [{id}]. Reason: {ex.Message}", ex);
        }
    }

    internal static async Task<T?> PartialModelUpdate<T>(int id, Dictionary<string, object?> patchFields, SqliteConnection connection, System.Data.Common.DbTransaction transaction, string path = "") where T : Model
    {
        var (_, errors) = CrudValidator.ValidateForPatch<T>(patchFields, path);

        // a record can only be patched by a valid, already-assigned id
        if (id <= 0)
        {
            var idPath = string.IsNullOrEmpty(path) ? "Id" : $"{path}.Id";
            errors.Add(new ValidationError
            {
                Field = idPath,
                Message = $"Field [{idPath}] has invalid value [{id}]. Record IDs must be greater than 0.",
            });
        }

        if (errors.Count > 0)
        {
            throw new Core.ValidationException("Validation failed.", errors);
        }

        var tableName = CrudInfo[typeof(T)].TableName;

        var modelValues = new Dictionary<PropertyInfo, Model>();
        var modelProperties = CrudInfo[typeof(T)].ModelProperties;
        if (modelProperties.Count > 0)
        {
            foreach (var field in patchFields)
            {
                var property = modelProperties.FirstOrDefault(p => string.Compare(p.Name, field.Key, StringComparison.OrdinalIgnoreCase) == 0);
                if (property == null)
                {
                    continue;
                }

                var currentPath = string.IsNullOrEmpty(path) ? property.Name : $"{path}.{property.Name}";

                if (field.Value is not JsonElement { ValueKind: JsonValueKind.Object } element)
                {
                    throw new Core.ValidationException($"Nested model property [{currentPath}] must be an object/dictionary.", new List<ValidationError>());
                }

                var nestedPatchFields = JsonSerializer.Deserialize<Dictionary<string, object?>>(element.GetRawText())!;

                if (!nestedPatchFields.TryGetValue("id", out var idFieldValue) || idFieldValue is not JsonElement idElement)
                {
                    throw new Core.ValidationException($"Nested model property [{currentPath}] must contain an 'id' field.", new List<ValidationError>());
                }

                // handle both numeric and string-encoded ids since JsonElement doesn't auto-coerce between them
                int nestedId = idElement.ValueKind switch
                {
                    JsonValueKind.Number when idElement.TryGetInt32(out var numericId) => numericId,
                    JsonValueKind.String when int.TryParse(idElement.GetString(), out var parsedId) => parsedId,
                    _ => throw new Core.ValidationException($"Nested model property [{currentPath}] 'id' field must be a valid integer.", new List<ValidationError>())
                };

                var updatedSubModel = await ExecuteGenericMethod(nameof(PartialModelUpdate), property.PropertyType, [nestedId, nestedPatchFields, connection, transaction, currentPath]);
                if (updatedSubModel == null)
                {
                    throw new Core.DatabaseException($"Nested model property [{currentPath}] could not be updated.");
                }

                modelValues[property] = updatedSubModel;
            }
        }

        var validProperties = CrudInfo[typeof(T)].ValidProperties;
        var (propertySetList, parameters) = BuildUpdateSetList(patchFields, validProperties);
        if (propertySetList.Count == 0)
        {
            throw new BadRequestException("No updatable fields were provided in the request.");
        }

        parameters.Add("Id", id);

        try
        {
            var sql = QueryBuilder.BuildUpdate(tableName, propertySetList);
            var record = await connection.QueryFirstOrDefaultAsync<T>(sql, parameters);

            if (record == null)
            {
                throw new DatabaseException($"[{tableName}] record [{id}] was not updated. Unknown reason.");
            }

            if (modelValues.Count > 0)
            {
                foreach (var kvp in modelValues)
                {
                    var property = kvp.Key;
                    var value = kvp.Value;
                    property.SetValue(record, value);
                }
            }

            return record;
        }
        catch (Exception ex)
        {
            throw new AppException($"Unable to patch [{tableName}] record [{id}]. Reason: {ex.Message}", ex);
        }
    }

    internal static async Task<Model?> ExecutePartialModelUpdate(Type modelType, int id, Dictionary<string, object?> patchFields, SqliteConnection connection, SqliteTransaction transaction, string path) => await ExecuteGenericMethod(nameof(FullModelUpdate), modelType, [id, patchFields, connection, transaction, path]);

    internal static async Task<Model?> ExecuteGenericMethod(string methodName, Type modelType, object[] parameters)
    {
        var allMethods = typeof(CRUD)
            .GetMethods(BindingFlags.NonPublic | BindingFlags.Static);
        var namedMethods = allMethods
            .Where(m => m.Name == methodName);
        var method = namedMethods.Single();
        var genericMethod = method.MakeGenericMethod(modelType);
        var task = (Task)genericMethod.Invoke(null, parameters)!;
        await task.ConfigureAwait(false);
        var resultProperty = task.GetType().GetProperty("Result");
        return (Model?)resultProperty!.GetValue(task);
    }

    internal static Task<T?> Delete<T>(string tableName, int id) where T : Model
    {
        using var connection = Database.Connect();
        return Delete<T>(tableName, id, connection);
    }

    internal static async Task<T?> Delete<T>(string tableName, int id, SqliteConnection connection) where T : Model
    {
        var sql = QueryBuilder.BuildDelete(tableName);
        var record = await connection.QueryFirstOrDefaultAsync<T>(sql, new { id });
        return record;
    }

    internal static async Task<T?> Delete_WithDocument<T>(string tableName, int id) where T : ModelWithDocument
    {
        using var connection = Database.Connect();
        using var transaction = await connection.BeginTransactionAsync();

        try
        {
            var record = await GetById_WithDocument<T>(tableName, id, connection);
            if (record == null)
            {
                throw new NotFoundException($"Record [{id}] not found in [{tableName}].");
            }

            try
            {
                var deleted = await Delete<T>(tableName, id, connection);
            }
            catch (Exception ex)
            {
                throw new DatabaseException($"Unable to delete [{tableName}] record [{id}]. Reason: {ex.Message}", ex);
            }

            try
            {
                var deletedDocument = await Delete<Document>(DocumentTableName, record.DocumentId, connection);
            }
            catch (Exception ex)
            {
                throw new DatabaseException($"Unable to delete document [{record.DocumentId}] for [{tableName}] record [{id}]. Reason: {ex.Message}", ex);
            }

            await transaction.CommitAsync();
            return record;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            throw new DatabaseException($"Unable to delete [{tableName}] record [{id}] with document. Reason: {ex.Message}", ex);
        }
    }

    private static (List<string> setList, DynamicParameters parameters) BuildUpdateSetList(Dictionary<string, object?> patchFields, FrozenDictionary<string, PropertyInfo> validProperties)
    {
        var parameters = new DynamicParameters();
        var setList = new List<string>();

        foreach (var field in patchFields)
        {
            if (!validProperties.TryGetValue(field.Key, out var property))
            {
                continue;
            }

            var dbValue = ConvertPatchValue(field.Value, property.PropertyType) ?? DBNull.Value;

            var snake = Formatting.PascalToSnakeCase(property.Name);
            setList.Add($"{snake} = @{property.Name}");
            if (property.PropertyType.IsEnum && dbValue is not null)
            {
                parameters.Add(property.Name, dbValue.ToString(), DbType.String);
            }
            else
            {
                parameters.Add(property.Name, dbValue);
            }
        }

        return (setList, parameters);
    }

    private static DynamicParameters BuildModelParameters<T>(T data) where T : Model
    {
        var parameters = new DynamicParameters(data);

        foreach (var property in typeof(T).GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (property.PropertyType.IsEnum && property.GetValue(data) is { } value)
            {
                parameters.Add(property.Name, value.ToString(), DbType.String);
            }
        }

        return parameters;
    }

    private static object? ConvertPatchValue(object? value, Type targetType)
    {
        if (value is null)
        {
            return null;
        }

        var effectiveType = Nullable.GetUnderlyingType(targetType) ?? targetType;

        if (effectiveType.IsEnum && value is Enum enumValue)
        {
            return enumValue.ToString();
        }

        if (value is not JsonElement jsonElement)
        {
            return value;
        }

        if (jsonElement.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        if (effectiveType == typeof(string))
        {
            return jsonElement.GetString();
        }

        if (effectiveType.IsEnum)
        {
            return jsonElement.ValueKind switch
            {
                JsonValueKind.String => Enum.Parse(effectiveType, jsonElement.GetString()!, ignoreCase: true),
                JsonValueKind.Number => Enum.ToObject(effectiveType, jsonElement.GetInt32()),
                _ => throw new NotSupportedException($"JSON value kind '{jsonElement.ValueKind}' cannot be converted to enum '{effectiveType.Name}'.")
            };
        }

        return JsonSerializer.Deserialize(jsonElement.GetRawText(), effectiveType);
    }
}

/// <summary>A resolved <see cref="RequireOneWhenCreatingAttribute"/> pairing; the string property names are bound to reflection metadata once, at registration.</summary>
internal sealed record RequireOneWhenCreatingGroup
{
    required internal PropertyInfo First { get; init; }

    required internal PropertyInfo Second { get; init; }

    required internal string Message { get; init; }
}

internal class CrudGeneratorInfo
{
    required internal FrozenDictionary<string, PropertyInfo> ValidProperties { get; set; }

    required internal string TableName { get; set; }

    required internal IReadOnlyList<string> InsertFields { get; set; }

    required internal IReadOnlyList<string> InsertValues { get; set; }

    required internal IReadOnlyList<string> FullUpdateSetProperties { get; set; }

    required internal IReadOnlyList<PropertyInfo> RequiredProperties { get; set; }

    required internal IReadOnlyList<PropertyInfo> RequiredWhenCreatingProperties { get; set; }

    required internal IReadOnlyList<PropertyInfo> RequiredWhenUpdatingProperties { get; set; }

    required internal IReadOnlyList<RequireOneWhenCreatingGroup> RequireOneWhenCreatingGroups { get; set; }

    required internal IReadOnlyList<PropertyInfo> ModelProperties { get; set; }
}

internal static class CrudInfoGeneration
{
    internal static readonly Dictionary<Type, CrudGeneratorInfo> CrudInfo = [];

    internal static readonly FrozenSet<string> SystemFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "Id", "CreatedAt", "UpdatedAt",
    }.ToFrozenSet(StringComparer.OrdinalIgnoreCase);

    internal static CrudGeneratorInfo GenerateCrudInfo<T>(string tableName) where T : Model
    {
        var crudInfo = new CrudGeneratorInfo
        {
            TableName = tableName,
            ValidProperties = GetValidProperties<T>(),
            InsertFields = GetInsertFields<T>(),
            InsertValues = GetInsertValues<T>(),
            FullUpdateSetProperties = GetFullUpdateSetProperties<T>(),
            RequiredProperties = GetRequiredAlwaysProperties<T>(),
            RequiredWhenCreatingProperties = GetRequiredWhenCreatingProperties<T>(),
            RequiredWhenUpdatingProperties = GetRequiredWhenUpdatingProperties<T>(),
            RequireOneWhenCreatingGroups = GetRequireOneWhenCreatingGroups<T>(),
            ModelProperties = GetModelProperties<T>(),
        };

        return crudInfo;
    }

    internal static CrudGeneratorInfo GetCrudInfo<T>() where T : Model
    {
        var modelType = typeof(T);
        if (CrudInfo.ContainsKey(modelType))
        {
            return CrudInfo[modelType];
        }

        var crufInfo = new CrudGeneratorInfo
        {
            TableName = string.Empty,
            ValidProperties = new List<PropertyInfo>().ToFrozenDictionary(p => p.Name, StringComparer.OrdinalIgnoreCase),
            InsertFields = new List<string>().AsReadOnly(),
            InsertValues = new List<string>().AsReadOnly(),
            FullUpdateSetProperties = new List<string>().AsReadOnly(),
            RequiredProperties = new List<PropertyInfo>().AsReadOnly(),
            RequiredWhenCreatingProperties = new List<PropertyInfo>().AsReadOnly(),
            RequiredWhenUpdatingProperties = new List<PropertyInfo>().AsReadOnly(),
            RequireOneWhenCreatingGroups = new List<RequireOneWhenCreatingGroup>().AsReadOnly(),
            ModelProperties = new List<PropertyInfo>().AsReadOnly(),
        };
        return crufInfo;
    }

    internal static FrozenDictionary<string, PropertyInfo> GetValidProperties<T>() => typeof(T)
       .GetProperties(BindingFlags.Public | BindingFlags.Instance)
       .Where(p => !SystemFields.Contains(p.Name))
       .Where(p => !typeof(Model).IsAssignableFrom(p.PropertyType))
       .ToFrozenDictionary(p => p.Name, StringComparer.OrdinalIgnoreCase);

    internal static IReadOnlyList<string> GetInsertFields<T>() => typeof(T)
       .GetProperties(BindingFlags.Public | BindingFlags.Instance)
       .Where(p => !SystemFields.Contains(p.Name))
       .Where(p => !typeof(Model).IsAssignableFrom(p.PropertyType))
       .Select(p => Formatting.PascalToSnakeCase(p.Name))
       .ToList().AsReadOnly();

    internal static IReadOnlyList<string> GetInsertValues<T>() => typeof(T)
       .GetProperties(BindingFlags.Public | BindingFlags.Instance)
       .Where(p => !SystemFields.Contains(p.Name))
       .Where(p => !typeof(Model).IsAssignableFrom(p.PropertyType))
       .Select(p => $"@{p.Name}")
       .ToList().AsReadOnly();

    internal static IReadOnlyList<string> GetFullUpdateSetProperties<T>() => typeof(T)
       .GetProperties(BindingFlags.Public | BindingFlags.Instance)
       .Where(p => !SystemFields.Contains(p.Name))
       .Where(p => !typeof(Model).IsAssignableFrom(p.PropertyType))
       .Select(p => $"{Formatting.PascalToSnakeCase(p.Name)} = @{p.Name}")
       .ToList().AsReadOnly();

    internal static IReadOnlyList<PropertyInfo> GetRequiredAlwaysProperties<T>() => typeof(T).GetProperties()
        .Where(prop => Attribute.IsDefined(prop, typeof(RequiredAttribute)))
        .ToList().AsReadOnly();

    internal static IReadOnlyList<PropertyInfo> GetRequiredWhenCreatingProperties<T>() => typeof(T).GetProperties()
        .Where(prop => Attribute.IsDefined(prop, typeof(RequiredWhenCreatingAttribute)))
        .ToList().AsReadOnly();

    internal static IReadOnlyList<PropertyInfo> GetRequiredWhenUpdatingProperties<T>() => typeof(T).GetProperties()
        .Where(prop => Attribute.IsDefined(prop, typeof(RequiredWhenUpdatingAttribute)))
        .ToList().AsReadOnly();

    internal static IReadOnlyList<RequireOneWhenCreatingGroup> GetRequireOneWhenCreatingGroups<T>()
    {
        var modelType = typeof(T);
        var groups = new List<RequireOneWhenCreatingGroup>();

        foreach (var property in modelType.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            foreach (var attribute in property.GetCustomAttributes<RequireOneWhenCreatingAttribute>())
            {
                groups.Add(new RequireOneWhenCreatingGroup
                {
                    First = ResolveGroupProperty(modelType, property, attribute.FirstProperty),
                    Second = ResolveGroupProperty(modelType, property, attribute.SecondProperty),
                    Message = attribute.FormatErrorMessage(property.Name),
                });
            }
        }

        return groups.AsReadOnly();
    }

    internal static IReadOnlyList<PropertyInfo> GetModelProperties<T>() => typeof(T)
       .GetProperties(BindingFlags.Public | BindingFlags.Instance)
       .Where(p => !SystemFields.Contains(p.Name))
       .Where(p => typeof(Model).IsAssignableFrom(p.PropertyType))
       .ToList().AsReadOnly();

    // a misspelled property name in the attribute must fail at registration, not silently disable the rule at validation time
    private static PropertyInfo ResolveGroupProperty(Type modelType, PropertyInfo declaringProperty, string propertyName)
        => modelType.GetProperty(propertyName, BindingFlags.Public | BindingFlags.Instance)
            ?? throw new InvalidOperationException($"[{nameof(RequireOneWhenCreatingAttribute)}] on [{modelType.Name}.{declaringProperty.Name}] references property [{propertyName}], which does not exist on [{modelType.Name}].");
}

public record ValidationResult(bool isValid, List<ValidationError> errors);

/// <summary>Selects which required-attribute set applies to a validation pass.</summary>
internal enum ValidationMode
{
    Create,
    Update,
    Patch,
}

public static class CrudValidator
{
    public static ValidationResult ValidateForCreate<T>(T data, string path = "") where T : Model => ValidateFull(data, ValidationMode.Create, path);

    public static ValidationResult ValidateForUpdate<T>(T data, string path = "") where T : Model => ValidateFull(data, ValidationMode.Update, path);

    public static ValidationResult ValidateForPatch<T>(Dictionary<string, object?> patchFields, string path = "") where T : Model
    {
        var errors = new List<ValidationError>();

        if (patchFields == null)
        {
            errors.Add(new ValidationError
            {
                Field = "input-data",
                Message = "Input data cannot be null.",
            });
            return new(isValid: false, errors);
        }

        ValidatePatchFields(typeof(T), patchFields, path, errors);

        return new(isValid: errors.Count == 0, errors);
    }

    // Unlike HasValue, a value type left at its declared default counts as *not provided*. An unset
    // foreign key id is 0, which is never a valid autoincrement key, so 0 means "the caller said nothing".
    // Comparing against default(declared type) rather than special-casing int keeps this correct for
    // long, Nullable<int>, and any future id type.
    internal static bool HasProvidedValue(PropertyInfo property, object instance)
    {
        var value = property.GetValue(instance);

        if (value is null)
        {
            return false;
        }

        var propertyType = Nullable.GetUnderlyingType(property.PropertyType) ?? property.PropertyType;
        if (propertyType.IsValueType)
        {
            return !value.Equals(Activator.CreateInstance(propertyType));
        }

        return HasValue(value);
    }

    private static ValidationResult ValidateFull(Model? data, ValidationMode mode, string path)
    {
        var errors = new List<ValidationError>();

        if (data == null)
        {
            errors.Add(new ValidationError
            {
                Field = "input-data",
                Message = "Input data cannot be null.",
            });
            return new(isValid: false, errors);
        }

        ValidateModel(data, mode, path, errors);

        return new(isValid: errors.Count == 0, errors);
    }

    private static void ValidateModel(Model data, ValidationMode mode, string path, List<ValidationError> errors)
    {
        if (!CrudInfoGeneration.CrudInfo.TryGetValue(data.GetType(), out var crudInfo))
        {
            return;
        }

        ValidateRequiredProperties(data, crudInfo, mode, path, errors);

        // the update and patch modes are covered by [RequiredWhenUpdating] on the foreign key id property
        if (mode == ValidationMode.Create)
        {
            ValidateRequireOneWhenCreatingGroups(data, crudInfo, path, errors);
        }

        // mirrors the CRUD recursion: every nested model is validated under the same mode
        foreach (var property in crudInfo.ModelProperties)
        {
            if (property.GetValue(data) is not Model nestedModel)
            {
                continue;
            }

            ValidateModel(nestedModel, mode, BuildPath(path, property.Name), errors);
        }
    }

    private static void ValidateRequiredProperties(Model data, CrudGeneratorInfo crudInfo, ValidationMode mode, string path, List<ValidationError> errors)
    {
        foreach (var property in RequiredPropertiesFor(crudInfo, mode))
        {
            var currentPath = BuildPath(path, property.Name);
            var value = property.GetValue(data);

            if (!HasValue(value))
            {
                errors.Add(new ValidationError
                {
                    Field = currentPath,
                    Message = $"Required field [{currentPath}] is missing.",
                });
                continue;
            }

            // an updated record can only point at an already-assigned, valid row; the model's own Id is
            // validated separately in FullModelUpdate against the route/recursion id, not the request body
            if (mode == ValidationMode.Update && property.Name != nameof(Model.Id) && value is int intValue && intValue <= 0)
            {
                errors.Add(new ValidationError
                {
                    Field = currentPath,
                    Message = $"Field [{currentPath}] has invalid value [{intValue}]. Record IDs must be greater than 0.",
                });
            }
        }
    }

    private static void ValidateRequireOneWhenCreatingGroups(Model data, CrudGeneratorInfo crudInfo, string path, List<ValidationError> errors)
    {
        foreach (var group in crudInfo.RequireOneWhenCreatingGroups)
        {
            var firstPath = BuildPath(path, group.First.Name);
            var secondPath = BuildPath(path, group.Second.Name);
            var hasFirst = HasProvidedValue(group.First, data);
            var hasSecond = HasProvidedValue(group.Second, data);

            if (!hasFirst && !hasSecond)
            {
                errors.Add(new ValidationError
                {
                    Field = firstPath,
                    Message = group.Message,
                });
                continue;
            }

            // a child object means "create this child", so one carrying an id is never a valid create-time input
            if (group.First.GetValue(data) is Model child && child.Id != 0)
            {
                errors.Add(new ValidationError
                {
                    Field = firstPath,
                    Message = $"Field [{firstPath}] has Id [{child.Id}]. A child object may only be sent when creating a new child record — to link an existing record, send [{secondPath}] instead and omit [{firstPath}].",
                });
                continue;
            }

            // validate that foreign key IDs are positive when provided (0 is "not provided", > 0 is valid link)
            if (group.Second.GetValue(data) is int fkId && fkId < 0)
            {
                errors.Add(new ValidationError
                {
                    Field = secondPath,
                    Message = $"Field [{secondPath}] has invalid value [{fkId}]. Record IDs must be greater than 0.",
                });
                continue;
            }

            if (hasFirst && hasSecond)
            {
                errors.Add(new ValidationError
                {
                    Field = firstPath,
                    Message = $"Only one of [{firstPath}] or [{secondPath}] may be provided when creating a new record. [{firstPath}] creates a new child record; [{secondPath}] links to an existing one.",
                });
            }
        }
    }

    private static void ValidatePatchFields(Type modelType, Dictionary<string, object?> patchFields, string path, List<ValidationError> errors)
    {
        if (!CrudInfoGeneration.CrudInfo.TryGetValue(modelType, out var crudInfo))
        {
            return;
        }

        var validProperties = new Dictionary<string, PropertyInfo>(crudInfo.ValidProperties, StringComparer.OrdinalIgnoreCase);
        var requiredNames = RequiredPropertiesFor(crudInfo, ValidationMode.Patch)
            .Select(p => p.Name)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var key in patchFields.Keys)
        {
            if (key == "id")
            {
                continue;
            }

            var currentPath = BuildPath(path, key);
            var modelProperty = crudInfo.ModelProperties.FirstOrDefault(f => string.Compare(f.Name, key, StringComparison.OrdinalIgnoreCase) == 0);

            if (modelProperty == null && !validProperties.ContainsKey(key))
            {
                errors.Add(new ValidationError
                {
                    Field = currentPath,
                    Message = $"Field [{currentPath}] is not valid for this model.",
                });
                continue;
            }

            // a patch only asserts the required rule for the fields it actually carries
            if (requiredNames.Contains(key) && !HasValue(patchFields[key]))
            {
                errors.Add(new ValidationError
                {
                    Field = currentPath,
                    Message = $"Required field [{currentPath}] is missing.",
                });
            }

            if (modelProperty == null)
            {
                continue;
            }

            if (patchFields[key] is JsonElement { ValueKind: JsonValueKind.Object } element)
            {
                var nestedPatchFields = JsonSerializer.Deserialize<Dictionary<string, object?>>(element.GetRawText())!;
                ValidatePatchFields(modelProperty.PropertyType, nestedPatchFields, currentPath, errors);
            }
            else
            {
                errors.Add(new ValidationError
                {
                    Field = currentPath,
                    Message = $"Field [{currentPath}] must be an object with nested properties that match type {modelProperty.PropertyType.Name}.",
                });
                return;
            }
        }
    }

    private static IEnumerable<PropertyInfo> RequiredPropertiesFor(CrudGeneratorInfo crudInfo, ValidationMode mode)
    {
        var conditional = mode == ValidationMode.Create
            ? crudInfo.RequiredWhenCreatingProperties
            : crudInfo.RequiredWhenUpdatingProperties;

        return crudInfo.RequiredProperties.Concat(conditional).DistinctBy(p => p.Name);
    }

    private static string BuildPath(string path, string name) => string.IsNullOrWhiteSpace(path) ? name : $"{path}.{name}";

    // takes object? rather than a generic: a boxed Nullable<V> always unboxes to its underlying type,
    // so a generic overload could never observe the nullable case anyway.
    private static bool HasValue(object? value)
    {
        if (value is null)
        {
            return false;
        }

        if (value is string s)
        {
            return !string.IsNullOrWhiteSpace(s);
        }

        if (value is JsonElement element)
        {
            return element.ValueKind switch
            {
                JsonValueKind.Null or JsonValueKind.Undefined => false,
                JsonValueKind.String => !string.IsNullOrWhiteSpace(element.GetString()),
                _ => true,
            };
        }

        if (value is System.Collections.IEnumerable e)
        {
            // collections must have items
            return e.GetEnumerator().MoveNext();
        }

        // value types have a value by default
        return true;
    }
}