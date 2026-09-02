namespace JobSearchAssistant.DB.Models;

using System.ComponentModel.DataAnnotations;

using JobSearchAssistant.Core;

public class AiPrompt : Model
{
    [Required]
    public string Name { get; set; } = string.Empty;

    [Required]
    public string AiUrl { get; set; } = string.Empty;

    [RequireOneWhenCreating(nameof(JobPosting), nameof(JobPostingId))]
    public JobPosting? JobPosting { get; set; }

    [RequiredWhenUpdating]
    public int JobPostingId { get; set; }

    [RequireOneWhenCreating(nameof(Resume), nameof(ResumeId))]
    public Resume? Resume { get; set; }

    [RequiredWhenUpdating]
    public int ResumeId { get; set; }

    [RequireOneWhenCreating(nameof(AiPromptTemplate), nameof(AiPromptTemplateId))]
    public AiPromptTemplate? AiPromptTemplate { get; set; }

    [RequiredWhenUpdating]
    public int AiPromptTemplateId { get; set; }

    [RequireOneWhenCreating(nameof(PromptDocument), nameof(PromptDocumentId))]
    public Document? PromptDocument { get; set; }

    [RequiredWhenUpdating]
    public int PromptDocumentId { get; set; }

    [RequireOneWhenCreating(nameof(ResponseDocument), nameof(ResponseDocumentId))]
    public Document? ResponseDocument { get; set; }

    [RequiredWhenUpdating]
    public int ResponseDocumentId { get; set; }
}
