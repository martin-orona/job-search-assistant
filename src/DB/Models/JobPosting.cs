namespace JobSearchAssistant.DB.Models;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// The work model of the job posting (e.g., Remote, InOffice, Hybrid).
/// </summary>
public enum WorkModel
{
    /// <summary>Unknown work model.</summary>
    Unknown,

    /// <summary>Remote work model.</summary>
    Remote,

    /// <summary>In-office work model.</summary>
    InOffice,

    /// <summary>Hybrid work model.</summary>
    Hybrid,
}

public class JobPosting : ModelWithDocument
{
    [Required]
    public string Title { get; set; } = string.Empty;

    [Required]
    public string Company { get; set; } = string.Empty;

    [Required]
    public string Location { get; set; } = string.Empty;

    [Required]
    public string Salary { get; set; } = string.Empty;

    [Required]
    public string Url { get; set; } = string.Empty;

    [Required]
    public WorkModel WorkModel { get; set; } = WorkModel.Unknown;
}
