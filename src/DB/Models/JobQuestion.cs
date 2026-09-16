namespace JobSearchAssistant.DB.Models;

using System.ComponentModel.DataAnnotations;

public class JobQuestion : Model
{
    [Required]
    public string Question { get; set; } = string.Empty;

    public string? Answer { get; set; }

    public int JobApplicationId { get; set; }
}
