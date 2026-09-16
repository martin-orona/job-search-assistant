namespace JobSearchAssistant.Server;

using JobSearchAssistant.DB.Models;

using DB = JobSearchAssistant.DB.Services;

public class JobApplications : BaseController<JobApplication>
{
    public JobApplications() : base(new DB.JobApplications(), "job-applications", new() { ["GetById"] = "GetJobApplicationById" })
    {
    }
}
