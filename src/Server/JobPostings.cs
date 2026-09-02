namespace JobSearchAssistant.Server;

using JobSearchAssistant.DB.Models;

using DB = JobSearchAssistant.DB.Services;

public class JobPostings : BaseController<JobPosting>
{
    public JobPostings() : base(new DB.JobPostings(), "job-postings", new() { ["GetById"] = "GetJobPostingById" })
    {
    }
}
