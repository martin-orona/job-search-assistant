namespace JobSearchAssistant.DB.Services;

using JobSearchAssistant.DB.Models;

public class AiPromptTemplates : ModelCrud<AiPromptTemplate>
{
    static AiPromptTemplates() => CRUD.RegisterCrudInfo<AiPromptTemplate>("ai_prompt_template");

    public AiPromptTemplates() : base("ai_prompt_template")
    {
    }
}
