namespace JobSearchAssistant.DB.Services;

using JobSearchAssistant.DB.Models;

public class JobPostings : ModelWithDocumentCrud<JobPosting>
{
    static JobPostings() => CRUD.RegisterCrudInfo<JobPosting>("job_posting");

    public JobPostings() : base("job_posting")
    {
    }
}
