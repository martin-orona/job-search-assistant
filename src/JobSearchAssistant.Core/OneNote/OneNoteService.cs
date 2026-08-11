using System.Reflection;
using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;

namespace JobSearchAssistant.Core.OneNote;

/// <summary>
/// IOneNoteService implementation using the OneNote COM API via late-binding.
/// All COM calls are marshalled onto a single, long-lived STA thread so the
/// COM object is always used from the thread that created it.
/// </summary>
public sealed class OneNoteService : IOneNoteService, IDisposable
{
    private readonly ILogger<OneNoteService> _logger;
    private readonly object _com;
    private readonly Type _comType;
    private readonly StaDispatcher _sta;
    private bool _disposed;

    // COM HierarchyScope.hsPages = 4
    private const int HsScopePages = 4;
    // COM PageInfo.piBasic = 0
    private const int PageInfoBasic = 0;

    public OneNoteService(ILogger<OneNoteService> logger)
    {
        _logger = logger;
        // Try versioned ProgIDs newest-first; C2R 32-bit Office typically registers all three
        _comType = Type.GetTypeFromProgID("OneNote.Application.6")
                ?? Type.GetTypeFromProgID("OneNote.Application")
                ?? throw new SyncException(SyncErrorCode.OneNoteUnavailable,
                    "OneNote desktop (Microsoft 365 or 2016+) is not installed or not registered. " +
                    "The UWP/Store version of OneNote does not support the COM API.");

        _sta = new StaDispatcher();
        try
        {
            _com = _sta.Invoke(() => Activator.CreateInstance(_comType))
                ?? throw new SyncException(SyncErrorCode.OneNoteUnavailable,
                    "Could not create OneNote COM instance.");
        }
        catch (Exception ex) when (TryGetComException(ex, out var comEx))
        {
            throw BuildComSyncException("CreateInstance", comEx);
        }
    }

    public Task<string> GetHierarchyXmlAsync(CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        return Task.Run(() => _sta.Invoke(InvokeGetHierarchy, ct), ct);
    }

    public Task<OneNotePage> ResolvePageAsync(string path, CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        return Task.Run(() => _sta.Invoke(() =>
        {
            _logger.LogDebug("Fetching OneNote hierarchy…");
            var hierarchyXml = InvokeGetHierarchy();
            var resolved = PathResolver.Resolve(path, hierarchyXml);

            _logger.LogDebug("Resolved page: {FullPath} (ID={Id})", resolved.FullPath, resolved.Id);
            var link = InvokeGetHyperlink(resolved.Id);

            return new OneNotePage
            {
                Id = resolved.Id,
                Title = resolved.Name,
                CanonicalLink = link,
                NotebookPath = path
            };
        }, ct), ct);
    }

    public Task<string> GetPageContentXmlAsync(string pageId, CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        return Task.Run(() => _sta.Invoke(() =>
        {
            _logger.LogDebug("Loading raw page XML for page {PageId}…", pageId);
            return InvokeGetPageContent(pageId);
        }, ct), ct);
    }

    public Task<IReadOnlyList<OneNoteParagraph>> GetScopedParagraphsAsync(
        OneNotePage page, string headerText, string paragraphStyle, CancellationToken ct = default)
    {
        ct.ThrowIfCancellationRequested();
        return Task.Run(() => _sta.Invoke(() =>
        {
            _logger.LogDebug("Loading page content for '{Title}'…", page.Title);
            var pageXml = InvokeGetPageContent(page.Id);

            var styleIndex = PageScoper.BuildStyleIndex(pageXml);
            var scoped = PageScoper.GetScopedElements(pageXml, headerText, styleIndex);
            var paragraphs = ParagraphFilter.Filter(scoped, paragraphStyle);

            _logger.LogDebug("Found {Count} matching paragraphs.", paragraphs.Count);
            return (IReadOnlyList<OneNoteParagraph>)paragraphs;
        }, ct), ct);
    }

    // ── COM call helpers ─────────────────────────────────────────────────────

    private string InvokeGetHierarchy()
    {
        var args = new object?[] { "", HsScopePages, "" };
        InvokeCom("GetHierarchy", args);
        return (string)args[2]!;
    }

    private string InvokeGetPageContent(string pageId)
    {
        var args = new object?[] { pageId, "", PageInfoBasic };
        InvokeCom("GetPageContent", args);
        return (string)args[1]!;
    }

    private string InvokeGetHyperlink(string pageId)
    {
        try
        {
            var args = new object?[] { pageId, "", "" };
            InvokeCom("GetHyperlinkToObject", args);
            return (string)args[2]!;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Could not get hyperlink for page {Id}: {Message}", pageId, ex.Message);
            return string.Empty;
        }
    }

    private void InvokeCom(string method, object?[] args)
    {
        try
        {
            _comType.InvokeMember(method,
                BindingFlags.InvokeMethod | BindingFlags.Public | BindingFlags.Instance,
                null, _com, args);
        }
        catch (Exception ex) when (TryGetComException(ex, out var comEx))
        {
            throw BuildComSyncException(method, comEx);
        }
    }

    private static bool TryGetComException(Exception ex, out COMException comEx)
    {
        for (Exception? current = ex; current is not null; current = current.InnerException)
        {
            if (current is COMException found)
            {
                comEx = found;
                return true;
            }
        }

        comEx = null!;
        return false;
    }

    private static SyncException BuildComSyncException(string operation, COMException comEx)
    {
        const uint TypeLibNotRegistered = 0x8002801D;
        const uint ServerExecFailed = 0x80080005;
        var hr = unchecked((uint)comEx.HResult);
        var hrText = $"0x{hr:X8}";

        if (hr == TypeLibNotRegistered)
        {
            return new SyncException(
                SyncErrorCode.OneNoteUnavailable,
                "OneNote is installed but its COM type library is not registered " +
                "(TYPE_E_LIBNOTREGISTERED, 0x8002801D). " +
                "Try running ONENOTE.EXE /regserver, then if needed run an Office Quick Repair.",
                comEx);
        }

            if (hr == ServerExecFailed)
            {
                return new SyncException(
                SyncErrorCode.OneNoteUnavailable,
                "OneNote COM server failed to start (CO_E_SERVER_EXEC_FAILURE, 0x80080005). " +
                "Open OneNote desktop manually, complete any first-run/sign-in/update prompts, then retry local-smoke. " +
                "If it persists, run Office Online Repair and reboot.",
                comEx);
            }

        return new SyncException(
            SyncErrorCode.OneNoteUnavailable,
            $"OneNote COM error during {operation}: {comEx.Message} ({hrText})",
            comEx);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        if (!_sta.TryInvoke(() => Marshal.ReleaseComObject(_com), TimeSpan.FromSeconds(1)))
            _logger.LogDebug("Skipping COM release because OneNote STA thread is busy or blocked.");
        _sta.Dispose();
    }

    // ── Single persistent STA thread ─────────────────────────────────────────

    private sealed class StaDispatcher : IDisposable
    {
        private readonly System.Collections.Concurrent.BlockingCollection<WorkItem> _queue = new();
        private readonly Thread _thread;

        public StaDispatcher()
        {
            _thread = new Thread(Loop) { IsBackground = true, Name = "OneNote-STA" };
            _thread.SetApartmentState(ApartmentState.STA);
            _thread.Start();
        }

        public void Invoke(Action action, CancellationToken ct = default)
        {
            var item = new WorkItem(() => { action(); return (object?)null; });
            EnqueueAndWait(item, ct);
            item.Error?.Throw();
        }

        public T Invoke<T>(Func<T> func, CancellationToken ct = default)
        {
            var item = new WorkItem(() => func());
            EnqueueAndWait(item, ct);
            item.Error?.Throw();
            return (T)item.Result!;
        }

        public bool TryInvoke(Action action, TimeSpan timeout)
        {
            var item = new WorkItem(() =>
            {
                action();
                return (object?)null;
            });

            try
            {
                _queue.Add(item);
            }
            catch (InvalidOperationException)
            {
                return false;
            }

            if (!item.Done.Wait(timeout))
                return false;

            item.Error?.Throw();
            return true;
        }

        private void EnqueueAndWait(WorkItem item, CancellationToken ct)
        {
            _queue.Add(item, ct);
            if (!ct.CanBeCanceled)
            {
                item.Done.Wait();
                return;
            }

            var signaled = WaitHandle.WaitAny([item.Done.WaitHandle, ct.WaitHandle]);
            if (signaled == 1)
                throw new OperationCanceledException(ct);
        }

        private void Loop()
        {
            foreach (var item in _queue.GetConsumingEnumerable())
            {
                try { item.Result = item.Work(); }
                catch (Exception ex) { item.Error = ExceptionDispatchInfo.Capture(ex); }
                finally { item.Done.Set(); }
            }
        }

        public void Dispose() => _queue.CompleteAdding();

        private sealed class WorkItem(Func<object?> work)
        {
            public Func<object?> Work { get; } = work;
            public object? Result { get; set; }
            public ExceptionDispatchInfo? Error { get; set; }
            public ManualResetEventSlim Done { get; } = new();
        }
    }
}
