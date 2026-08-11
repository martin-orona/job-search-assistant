namespace JobSearchAssistant.Core;

public interface IExcelWriter
{
    Task<SyncResult> AppendRowsAsync(
        string workbookSource,
        string sheetName,
        string tableName,
        IReadOnlyList<SyncRow> rows,
        DuplicateStrategy duplicateStrategy,
        CancellationToken ct = default);
}
