namespace JobSearchAssistant.Server;

using JobSearchAssistant.DB.Models;

using DB = JobSearchAssistant.DB.Services;

public class JobQuestions : BaseController<JobQuestion>
{
    public JobQuestions() : base(new DB.JobQuestions(), "job-questions", new() { ["GetById"] = "GetJobQuestionById" })
    {
    }
}
