namespace JobSearchAssistant.DB.Models;

using System.ComponentModel.DataAnnotations;

public class Resume : ModelWithDocument
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string JobTitle { get; set; } = string.Empty;

    [Required]
    public DateTimeOffset Date { get; set; } = DateTimeOffset.UtcNow;
}
