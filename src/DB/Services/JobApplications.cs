namespace JobSearchAssistant.DB.Services;

using JobSearchAssistant.DB.Models;

public class JobApplications : ModelCrud<JobApplication>
{
    static JobApplications() => CRUD.RegisterCrudInfo<JobApplication>("job_application");

    public JobApplications() : base("job_application")
    {
    }
}
