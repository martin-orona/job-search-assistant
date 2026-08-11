namespace JobSearchAssistant.Core;

/// <summary>
/// Shared input contract used by both CLI and UI surfaces.
/// </summary>
public sealed class SyncRequest
{
    /// <summary>Notebook > section group > section > page path, delimited by &gt;.</summary>
    public required string OneNotePath { get; init; }

    /// <summary>Heading text that anchors the extraction scope.</summary>
    public required string HeaderText { get; init; }

    /// <summary>Paragraph style to include (e.g. "Heading 2").</summary>
    public required string ParagraphStyle { get; init; }

    /// <summary>Path or URL to the target Excel workbook.</summary>
    public required string WorkbookSource { get; init; }

    /// <summary>Name of the worksheet that contains the target table.</summary>
    public required string SheetName { get; init; }

    /// <summary>Name of the Excel table to append rows into.</summary>
    public required string TableName { get; init; }

    /// <summary>Preview proposed rows without writing them when true.</summary>
    public bool DryRun { get; init; }

    /// <summary>Emit detailed diagnostic output when true.</summary>
    public bool Verbose { get; init; }

    /// <summary>Maximum number of rows to append in a single run. Null means unlimited.</summary>
    public int? MaxRows { get; init; }

    /// <summary>Behaviour when a duplicate SourceKey is encountered.</summary>
    public DuplicateStrategy DuplicateStrategy { get; init; } = DuplicateStrategy.Skip;
}

public enum DuplicateStrategy
{
    Skip,
    Overwrite
}
