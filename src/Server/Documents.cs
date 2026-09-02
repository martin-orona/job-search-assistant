namespace JobSearchAssistant.Server;

using JobSearchAssistant.DB.Models;

using DB = JobSearchAssistant.DB.Services;

public class Documents : BaseController<Document>
{
    public Documents() : base(new DB.Documents(), "documents", new() { ["GetById"] = "GetDocumentById" })
    {
    }
}
