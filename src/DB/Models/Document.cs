namespace JobSearchAssistant.DB.Models;

using System.ComponentModel.DataAnnotations;

/// <summary>
/// Represents the type of a document.
/// </summary>
public enum DocumentType
{
    /// <summary>Unknown document type.</summary>
    Unknown,

    /// <summary>HTML document type.</summary>
    HTML,

    /// <summary>PDF document type.</summary>
    PDF,

    /// <summary>Markdown document type.</summary>
    Markdown,

    /// <summary>Plain text document type.</summary>
    Text,

    /// <summary>Word document type.</summary>
    Word,

    /// <summary>Other document type.</summary>
    Other,
}

public class Document : Model
{
    [Required]
    public string Title { get; set; } = string.Empty;

    [Required]
    public DocumentType Type { get; set; } = DocumentType.Unknown;

    [Required]
    public string Content { get; set; } = string.Empty;

    public string? Source { get; set; }
}
