namespace JobSearchAssistant.DB.Models;

using System.ComponentModel.DataAnnotations;

public class JobSource : Model
{
    [Required]
    public string Name { get; set; } = string.Empty;
}
