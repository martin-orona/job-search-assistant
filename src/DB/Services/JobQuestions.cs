namespace JobSearchAssistant.DB.Services;

using JobSearchAssistant.DB.Models;

public class JobQuestions : ModelCrud<JobQuestion>
{
    static JobQuestions() => CRUD.RegisterCrudInfo<JobQuestion>("job_question");

    public JobQuestions() : base("job_question")
    {
    }
}
