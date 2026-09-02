namespace JobSearchAssistant.Server;

using JobSearchAssistant.DB.Models;

using DB = JobSearchAssistant.DB.Services;

public class AiPromptTemplates : BaseController<AiPromptTemplate>
{
    public AiPromptTemplates() : base(new DB.AiPromptTemplates(), "ai-prompt-templates", new() { ["GetById"] = "GetAiPromptTemplateById" })
    {
    }
}
