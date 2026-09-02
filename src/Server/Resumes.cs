namespace JobSearchAssistant.Server;

using JobSearchAssistant.DB.Models;

using DB = JobSearchAssistant.DB.Services;

public class Resumes : BaseController<Resume>
{
    public Resumes() : base(new DB.Resumes(), "resumes", new() { ["GetById"] = "GetResumeById" })
    {
    }
}
