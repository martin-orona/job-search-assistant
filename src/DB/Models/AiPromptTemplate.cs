namespace JobSearchAssistant.DB.Models;

using System.ComponentModel.DataAnnotations;

public class AiPromptTemplate : Model
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string Template { get; set; } = string.Empty;
}
