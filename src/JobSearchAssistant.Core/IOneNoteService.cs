namespace JobSearchAssistant.Core;

public interface IOneNoteService
{
    Task<string> GetHierarchyXmlAsync(CancellationToken ct = default);

    Task<OneNotePage> ResolvePageAsync(string path, CancellationToken ct = default);

    Task<string> GetPageContentXmlAsync(string pageId, CancellationToken ct = default);

    Task<IReadOnlyList<OneNoteParagraph>> GetScopedParagraphsAsync(
        OneNotePage page,
        string headerText,
        string paragraphStyle,
        CancellationToken ct = default);
}

public sealed class OneNotePage
{
    public required string Id { get; init; }
    public required string Title { get; init; }
    public required string CanonicalLink { get; init; }
    public required string NotebookPath { get; init; }
}

public sealed class OneNoteParagraph
{
    public required string Text { get; init; }
    public required string Fingerprint { get; init; }
    public required string Locator { get; init; }
    public required string Style { get; init; }
    public int Order { get; init; }
}
