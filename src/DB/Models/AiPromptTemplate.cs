namespace JobSearchAssistant.DB.Models;

using System.ComponentModel.DataAnnotations;

public class AiPromptTemplate : ModelWithDocument
{
    [Required]
    public string Name { get; set; } = string.Empty;
}
