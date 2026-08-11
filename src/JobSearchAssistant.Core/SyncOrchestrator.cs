using Microsoft.Extensions.Logging;

namespace JobSearchAssistant.Core;

/// <summary>
/// Single workflow coordinator invoked by both CLI and UI front ends.
/// </summary>
public sealed class SyncOrchestrator
{
    private readonly IOneNoteService _oneNote;
    private readonly IExcelWriter _excel;
    private readonly ILogger<SyncOrchestrator> _logger;

    public SyncOrchestrator(
        IOneNoteService oneNote,
        IExcelWriter excel,
        ILogger<SyncOrchestrator> logger)
    {
        _oneNote = oneNote;
        _excel = excel;
        _logger = logger;
    }

    public async Task<SyncResult> RunAsync(SyncRequest request, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Resolving OneNote path: {Path}", request.OneNotePath);

        var page = await _oneNote.ResolvePageAsync(request.OneNotePath, cancellationToken);
        var paragraphs = await _oneNote.GetScopedParagraphsAsync(
            page, request.HeaderText, request.ParagraphStyle, cancellationToken);

        var limited = request.MaxRows.HasValue
            ? paragraphs.Take(request.MaxRows.Value).ToList()
            : paragraphs;

        var rows = limited.Select(p => new SyncRow
        {
            SourceKey = SourceKeyGenerator.Generate(request.OneNotePath, request.HeaderText, p.Fingerprint),
            ParagraphText = p.Text,
            PageLink = page.CanonicalLink,
            ParagraphLocator = p.Locator,
            NotebookPath = request.OneNotePath,
            Header = request.HeaderText,
            ParagraphStyle = request.ParagraphStyle,
            CapturedAtUtc = DateTime.UtcNow,
            Disposition = request.DryRun ? RowDisposition.DryRun : RowDisposition.Inserted
        }).ToList();

        if (request.DryRun)
        {
            _logger.LogInformation("Dry-run: {Count} rows proposed, no writes performed.", rows.Count);
            return new SyncResult { MatchedCount = rows.Count, Rows = rows, IsDryRun = true };
        }

        var writeResult = await _excel.AppendRowsAsync(
            request.WorkbookSource, request.SheetName, request.TableName,
            rows, request.DuplicateStrategy, cancellationToken);

        return writeResult;
    }
}
