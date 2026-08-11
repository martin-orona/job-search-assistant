namespace JobSearchAssistant.Core;

public sealed class SyncResult
{
    public int MatchedCount { get; init; }
    public int InsertedCount { get; init; }
    public int SkippedCount { get; init; }
    public IReadOnlyList<string> Errors { get; init; } = [];
    public IReadOnlyList<SyncRow> Rows { get; init; } = [];
    public bool IsDryRun { get; init; }
}

public sealed record SyncRow
{
    public required string SourceKey { get; init; }
    public required string ParagraphText { get; init; }
    public required string PageLink { get; init; }
    public required string ParagraphLocator { get; init; }
    public required string NotebookPath { get; init; }
    public required string Header { get; init; }
    public required string ParagraphStyle { get; init; }
    public DateTime CapturedAtUtc { get; init; }
    public RowDisposition Disposition { get; init; }
}

public enum RowDisposition { Inserted, Skipped, DryRun }
