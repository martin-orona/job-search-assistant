namespace JobSearchAssistant.Core;

public sealed class SyncException : Exception
{
    public SyncErrorCode Code { get; }
    public string? Detail { get; }

    public SyncException(SyncErrorCode code, string message, string? detail = null)
        : base(message)
    {
        Code = code;
        Detail = detail;
    }

    public SyncException(SyncErrorCode code, string message, Exception inner)
        : base(message, inner)
    {
        Code = code;
    }
}

public enum SyncErrorCode
{
    PathNotFound,
    PathAmbiguous,
    HeaderNotFound,
    StyleUnsupported,
    TableMissing,
    AuthFailed,
    WorkbookUnavailable,
    OneNoteUnavailable,
}
