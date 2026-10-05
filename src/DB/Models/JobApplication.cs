namespace JobSearchAssistant.DB.Models;

using System.ComponentModel.DataAnnotations;

using JobSearchAssistant.Core;

public class JobApplication : Model
{
    [Required]
    public string Company { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = string.Empty;

    public DateOnly? AppliedOnDate { get; set; }

    [Required]
    public ApplicationStatus Status { get; set; } = ApplicationStatus.Unknown;

    public List<PointOfContact> PointsOfContact { get; set; } = new List<PointOfContact>();

    public List<JobQuestion> Questions { get; set; } = new List<JobQuestion>();

    public List<Note> Notes { get; set; } = new List<Note>();

    [RequireOneWhenCreating(nameof(Source), nameof(SourceId))]
    public JobSource? Source { get; set; }

    [RequiredWhenUpdating]
    public int SourceId { get; set; }

    [RequireOneWhenCreating(nameof(JobPosting), nameof(JobPostingId))]
    public JobPosting? JobPosting { get; set; }

    [RequiredWhenUpdating]
    public int JobPostingId { get; set; }

    public Resume? Resume { get; set; }

    public int? ResumeId { get; set; }

    public Document? CoverLetter { get; set; }

    public int? CoverLetterId { get; set; }

    public AiPrompt? AiPrompt { get; set; }

    public int? AiPromptId { get; set; }

}

public record Note(DateOnly date, string content);

public record PointOfContact(string role, string name, string? email, string? phone);

/// <summary>
/// Represents the status of a job application.
/// </summary>
public enum ApplicationStatus
{
    /// <summary>Unknown application status.</summary>
    Unknown,

    /// <summary>The job application is in the draft stage.</summary>
    Draft,

    /// <summary>The job application has been saved but not yet submitted.</summary>
    Saved,

    /// <summary>The job application has been submitted.</summary>
    Applied,

    /// <summary>The job application is in the interviewing stage.</summary>
    Interviewing,

    /// <summary>The job application has received an offer.</summary>
    Offer,

    /// <summary>The job application has been accepted.</summary>
    Accepted,

    /// <summary>The job application has been rejected.</summary>
    Rejected,

    /// <summary>The job application has been withdrawn by the applicant.</summary>
    Withdrawn,

    /// <summary>The job application has been ghosted (no response from the employer).</summary>
    Ghosted,

    /// <summary>Other application status.</summary>
    Other,
}
