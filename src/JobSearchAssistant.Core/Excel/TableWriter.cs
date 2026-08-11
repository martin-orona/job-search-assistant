using ClosedXML.Excel;
using Microsoft.Extensions.Logging;

namespace JobSearchAssistant.Core.Excel;

/// <summary>
/// IExcelWriter implementation using ClosedXML.
/// Supports local .xlsx files. OneDrive/SharePoint sources must be mapped to a local path.
/// </summary>
public sealed class TableWriter : IExcelWriter
{
    private readonly ILogger<TableWriter> _logger;

    public TableWriter(ILogger<TableWriter> logger)
    {
        _logger = logger;
    }

    public Task<SyncResult> AppendRowsAsync(
        string workbookSource,
        string sheetName,
        string tableName,
        IReadOnlyList<SyncRow> rows,
        DuplicateStrategy duplicateStrategy,
        CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        return Task.Run(() => Append(workbookSource, sheetName, tableName, rows, duplicateStrategy), ct);
    }

    private SyncResult Append(
        string workbookSource,
        string sheetName,
        string tableName,
        IReadOnlyList<SyncRow> rows,
        DuplicateStrategy duplicateStrategy)
    {
        if (!File.Exists(workbookSource))
            throw new SyncException(SyncErrorCode.WorkbookUnavailable,
                $"Workbook not found: '{workbookSource}'");

        using var wb = new XLWorkbook(workbookSource);

        if (!wb.TryGetWorksheet(sheetName, out var ws))
            throw new SyncException(SyncErrorCode.TableMissing,
                $"Sheet '{sheetName}' not found in '{workbookSource}'.");

        var table = ws.Tables.FirstOrDefault(t =>
            string.Equals(t.Name, tableName, StringComparison.OrdinalIgnoreCase))
            ?? throw new SyncException(SyncErrorCode.TableMissing,
                $"Table '{tableName}' not found on sheet '{sheetName}'.");

        ValidateSchema(table);

        var existingKeys = GetExistingSourceKeys(table);

        int inserted = 0, skipped = 0;
        var resultRows = new List<SyncRow>();

        foreach (var row in rows)
        {
            if (existingKeys.Contains(row.SourceKey))
            {
                if (duplicateStrategy == DuplicateStrategy.Skip)
                {
                    _logger.LogDebug("Skipping duplicate SourceKey: {Key}", row.SourceKey);
                    resultRows.Add(row with { Disposition = RowDisposition.Skipped });
                    skipped++;
                    continue;
                }
            }

            AppendRow(table, row);
            existingKeys.Add(row.SourceKey);
            resultRows.Add(row with { Disposition = RowDisposition.Inserted });
            inserted++;
        }

        wb.Save();
        _logger.LogInformation("Excel write complete. Inserted={Inserted} Skipped={Skipped}", inserted, skipped);

        return new SyncResult
        {
            MatchedCount = rows.Count,
            InsertedCount = inserted,
            SkippedCount = skipped,
            Rows = resultRows,
        };
    }

    private static readonly string[] RequiredColumns =
    [
        "CapturedAtUtc", "NotebookPath", "Header", "ParagraphStyle",
        "ParagraphText", "PageLink", "ParagraphLocator", "SourceKey"
    ];

    private static void ValidateSchema(IXLTable table)
    {
        var headers = table.Fields.Select(f => f.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var missing = RequiredColumns.Where(c => !headers.Contains(c)).ToList();
        if (missing.Count > 0)
            throw new SyncException(SyncErrorCode.TableMissing,
                $"Table is missing required columns: {string.Join(", ", missing)}");
    }

    private static HashSet<string> GetExistingSourceKeys(IXLTable table)
    {
        var keyCol = table.Fields
            .First(f => string.Equals(f.Name, "SourceKey", StringComparison.OrdinalIgnoreCase))
            .Index + 1; // ClosedXML field index is 0-based; cell columns are 1-based

        var dataRange = table.DataRange;
        if (dataRange.RowCount() == 0) return [];

        return dataRange.Rows()
            .Select(r => r.Cell(keyCol).GetString())
            .Where(v => v.Length > 0)
            .ToHashSet(StringComparer.Ordinal);
    }

    private static void AppendRow(IXLTable table, SyncRow row)
    {
        table.AppendData(new[]
        {
            new object[]
            {
                row.CapturedAtUtc.ToString("o"),
                row.NotebookPath,
                row.Header,
                row.ParagraphStyle,
                row.ParagraphText,
                row.PageLink,
                row.ParagraphLocator,
                row.SourceKey
            }
        });
    }
}
