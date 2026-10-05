namespace JobSearchAssistant.DB.Services;

using System.Data.Common;
using System.Text.Json;

using Dapper;

using JobSearchAssistant.Core;
using JobSearchAssistant.DB.Models;

using Microsoft.Data.Sqlite;

public class JobApplications : ModelCrud<JobApplication>
{
    static JobApplications() => CRUD.RegisterCrudInfo<JobApplication>("job_application");

    public JobApplications() : base("job_application")
    {
    }

    internal static async Task<List<JobQuestion>> SaveQuestions(int applicationId, IEnumerable<JobQuestion> questions, SqliteConnection connection, DbTransaction transaction)
    {
        var savedQuestions = new List<JobQuestion>();
        foreach (var question in questions)
        {
            var candidate = new JobQuestion { Question = question.Question, Answer = question.Answer };
            var (_, errors) = CrudValidator.ValidateForCreate(candidate);
            if (errors.Count > 0)
            {
                throw new Core.ValidationException("Invalid application question.", errors);
            }

            if (question.Id < 0 || (question.Id > 0 && !await connection.ExecuteScalarAsync<bool>(
                "select exists(select 1 from job_question where id = @Id)", new { question.Id }, transaction)))
            {
                throw new BadRequestException($"Job Question [{question.Id}] does not exist or has an invalid ID.");
            }

            var saved = await connection.QueryFirstOrDefaultAsync<JobQuestion>(
                "select * from job_question where question = @Question and answer is @Answer order by id limit 1",
                candidate,
                transaction);
            saved ??= await CRUD.CreateModel(candidate, connection, transaction);
            if (saved == null)
            {
                throw new DatabaseException("Unable to save application question.");
            }

            if (savedQuestions.All(existing => existing.Id != saved.Id))
            {
                savedQuestions.Add(saved);
            }
        }

        await connection.ExecuteAsync("delete from job_application_question where job_application_id = @ApplicationId", new { ApplicationId = applicationId }, transaction);
        foreach (var question in savedQuestions)
        {
            await connection.ExecuteAsync(
                "insert into job_application_question (job_application_id, job_question_id) values (@ApplicationId, @QuestionId)",
                new { ApplicationId = applicationId, QuestionId = question.Id },
                transaction);
        }

        await connection.ExecuteAsync(
            "update job_application set questions = @Questions where id = @ApplicationId",
            new { ApplicationId = applicationId, Questions = JsonSerializer.Serialize(savedQuestions) },
            transaction);
        return savedQuestions;
    }
}
