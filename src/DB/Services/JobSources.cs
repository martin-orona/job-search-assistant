namespace JobSearchAssistant.DB.Services;

using JobSearchAssistant.DB.Models;

public class JobSources : ModelCrud<JobSource>
{
    static JobSources() => CRUD.RegisterCrudInfo<JobSource>("job_source");

    public JobSources() : base("job_source")
    {
    }
}
