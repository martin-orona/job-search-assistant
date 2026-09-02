namespace JobSearchAssistant.DB.Services;

using JobSearchAssistant.DB.Models;

public class AiPrompts : ModelCrud<AiPrompt>
{
    static AiPrompts() => CRUD.RegisterCrudInfo<AiPrompt>("ai_prompt");

    public AiPrompts() : base("ai_prompt")
    {
    }
}
