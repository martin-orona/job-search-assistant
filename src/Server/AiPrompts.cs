namespace JobSearchAssistant.Server;

using JobSearchAssistant.DB.Models;

using DB = JobSearchAssistant.DB.Services;

public class AiPrompts : BaseController<AiPrompt>
{
    public AiPrompts() : base(new DB.AiPrompts(), "ai-prompts", new() { ["GetById"] = "GetAiPromptById", })
    {
    }
}
