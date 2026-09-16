namespace JobSearchAssistant.Server;

using JobSearchAssistant.DB.Models;

using DB = JobSearchAssistant.DB.Services;

public class JobSources : BaseController<JobSource>
{
    public JobSources() : base(new DB.JobSources(), "job-sources", new() { ["GetById"] = "GetJobSourceById" })
    {
    }
}
