using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;

using WinHtmlFormatHelper = Windows.ApplicationModel.DataTransfer.HtmlFormatHelper;

namespace JobSearchAssistant.Maui;

public partial class ApplicationsPage : ContentPage
{
    private static readonly Regex DateClipboardRegex = new("^(?<date>\\d{8})(?:\\s+[A-Za-z]+)?$", RegexOptions.Compiled);
    private static readonly Regex AnchorRegex = new("<a\\b[^>]*\\bhref\\s*=\\s*\"(?<href>[^\"]+)\"[^>]*>(?<text>.*?)</a>", RegexOptions.IgnoreCase | RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex OneNoteLinkRegex = new("(?<href>onenote:[^\\s\"'<>]+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private const string NoOneNoteLinkMessage = "The clipboard doesn't contain a OneNote Link. Please copy the link to a paragraph and try again.";
    private const string OneNoteLinkFormatName = "OneNote Link";

    // Formats whose content we actually need. Reading anything else (images, OLE data objects, etc.) via
    // GetClipboardData can trigger delay-rendering: Windows asks the original clipboard owner to materialize
    // the data on demand, and if that round-trip stalls, our UI thread hangs indefinitely.
    private static bool IsFormatWeCareAbout(string name) =>
        string.Equals(name, OneNoteLinkFormatName, StringComparison.OrdinalIgnoreCase)
        || string.Equals(name, "HTML Format", StringComparison.OrdinalIgnoreCase)
        || IsPlainTextFormat(name)
        || IsAnsiTextFormat(name);
    private bool _isListening;
    private readonly SemaphoreSlim _clipboardProcessingGate = new(1, 1);
    private string? _currentDateToken;

    public ApplicationsPage() => InitializeComponent();

    protected override void OnDisappearing()
    {
        StopListening();
        base.OnDisappearing();
    }

    private void ListeningToggleButton_Clicked(object? sender, EventArgs e)
    {
        if (_isListening)
        {
            StopListening();
            return;
        }

        _isListening = true;
        Clipboard.Default.ClipboardContentChanged += ClipboardContentChanged;
        ListeningToggleButton.Style = (Style)Resources["ListeningActiveButtonStyle"];
        ListeningToggleButton.Text = "Stop Listening";
        ShowApplicationsStatus("Listening mode started.");
    }

    private void StopListening()
    {
        if (_isListening)
        {
            Clipboard.Default.ClipboardContentChanged -= ClipboardContentChanged;
            _isListening = false;
        }

        if (ListeningToggleButton is not null)
        {
            ListeningToggleButton.Style = null;
            ListeningToggleButton.Text = "Start Listening";
        }
    }

    private async void ClipboardContentChanged(object? sender, EventArgs e)
    {
        await _clipboardProcessingGate.WaitAsync();
        try
        {
            ClipboardSnapshot snapshot = CaptureClipboardSnapshot();
            await MainThread.InvokeOnMainThreadAsync(() => ProcessClipboardSnapshot(snapshot, writeToExcel: true));
        }
        catch (Exception ex)
        {
            await MainThread.InvokeOnMainThreadAsync(() => ShowApplicationsStatus($"Listening failed: {ex.Message}", true));
        }
        finally
        {
            _clipboardProcessingGate.Release();
        }
    }

    private void ReadClipboardButton_Clicked(object? sender, EventArgs e)
    {
        System.Diagnostics.Trace.WriteLine("ReadClipboardButton_Clicked :: START");

        try
        {
            System.Diagnostics.Trace.WriteLine("ReadClipboardButton_Clicked :: CaptureClipboardSnapshot()");
            ClipboardSnapshot snapshot = CaptureClipboardSnapshot();
            System.Diagnostics.Trace.WriteLine("ReadClipboardButton_Clicked :: ReadClipboardAndDisplay()");
            ReadClipboardAndDisplay(snapshot);
        }
        catch (Exception ex)
        {
            ShowApplicationsStatus($"Clipboard read failed: {ex.Message}", true);
        }
        System.Diagnostics.Trace.WriteLine("ReadClipboardButton_Clicked :: END");
    }

    // Enumerates every raw clipboard format via Win32 (WinRT's DataPackageView collapses synonym text
    // formats like "UnicodeText"/"System.String" into a single "Text" entry, hiding formats OneNote relies on).
    private static ClipboardSnapshot CaptureClipboardSnapshot()
    {
        DateTime timestamp = DateTime.Now;

        if (!OpenClipboard(IntPtr.Zero))
        {
            return new ClipboardSnapshot(timestamp, [], [], null, null, null);
        }

        try
        {
            var formatIds = new List<uint>();
            uint formatId = 0;
            while ((formatId = EnumClipboardFormats(formatId)) != 0)
            {
                formatIds.Add(formatId);
            }

            var formatNames = new List<string>();
            var entries = new List<ClipboardFormatEntry>();
            string? plainText = null;
            string? html = null;
            string? oneNoteLinkRaw = null;

            foreach (uint id in formatIds)
            {
                string name = ResolveFormatName(id);
                formatNames.Add(name);
                System.Diagnostics.Trace.WriteLine($"Format: {name}");

                object? value = null;
                Exception? error = null;
                if (!IsFormatWeCareAbout(name))
                {
                    value = "(skipped: not needed for OneNote link extraction; avoids delay-rendered/GDI format hangs and crashes)";
                }
                else
                {
                    try
                    {
                        value = ReadClipboardFormatValue(id, name);
                    }
                    catch (Exception ex)
                    {
                        error = ex;
                    }
                }

                entries.Add(new ClipboardFormatEntry(name, value, error));

                if (error is not null)
                {
                    continue;
                }

                if (value is string text)
                {
                    if (string.Equals(name, "HTML Format", StringComparison.OrdinalIgnoreCase))
                    {
                        html ??= WinHtmlFormatHelper.GetStaticFragment(text);
                    }
                    else if (plainText is null && (IsPlainTextFormat(name) || IsAnsiTextFormat(name)))
                    {
                        plainText = text;
                    }
                }
                else if (value is MemoryStream stream && string.Equals(name, OneNoteLinkFormatName, StringComparison.OrdinalIgnoreCase))
                {
                    oneNoteLinkRaw ??= Encoding.UTF8.GetString(stream.ToArray());
                }
            }

            return new ClipboardSnapshot(timestamp, formatNames, entries, plainText, html, oneNoteLinkRaw);
        }
        finally
        {
            CloseClipboard();
        }
    }

    private static bool IsPlainTextFormat(string format) =>
        format is "Text" or "UnicodeText" or "System.String" or "CF_UNICODETEXT";

    private static bool IsAnsiTextFormat(string format) =>
        format is "CF_TEXT" or "CF_OEMTEXT";

    private static string ResolveFormatName(uint format)
    {
        var buffer = new StringBuilder(256);
        int length = GetClipboardFormatName(format, buffer, buffer.Capacity);
        if (length > 0)
        {
            return buffer.ToString();
        }

        return format switch
        {
            1 => "CF_TEXT",
            2 => "CF_BITMAP",
            7 => "CF_OEMTEXT",
            8 => "CF_DIB",
            13 => "CF_UNICODETEXT",
            15 => "CF_HDROP",
            16 => "CF_LOCALE",
            17 => "CF_DIBV5",
            _ => $"Format {format}",
        };
    }

    // OneNote's link format and CF_HTML are byte-oriented; the "Text"/"UnicodeText"/"System.String" synonyms hold UTF-16.
    private static object? ReadClipboardFormatValue(uint format, string name)
    {
        IntPtr hGlobal = GetClipboardData(format);
        if (hGlobal == IntPtr.Zero)
        {
            return null;
        }

        IntPtr pointer = GlobalLock(hGlobal);
        if (pointer == IntPtr.Zero)
        {
            return null;
        }

        try
        {
            int size = (int)GlobalSize(hGlobal);
            var bytes = new byte[size];
            Marshal.Copy(pointer, bytes, 0, size);

            if (string.Equals(name, OneNoteLinkFormatName, StringComparison.OrdinalIgnoreCase))
            {
                return new MemoryStream(bytes);
            }

            if (string.Equals(name, "HTML Format", StringComparison.OrdinalIgnoreCase))
            {
                return DecodeNullTerminated(bytes, Encoding.UTF8);
            }

            if (IsPlainTextFormat(name))
            {
                return DecodeNullTerminated(bytes, Encoding.Unicode);
            }

            if (IsAnsiTextFormat(name))
            {
                return DecodeNullTerminated(bytes, Encoding.Latin1);
            }

            return new MemoryStream(bytes);
        }
        finally
        {
            GlobalUnlock(hGlobal);
        }
    }

    private static string DecodeNullTerminated(byte[] bytes, Encoding encoding)
    {
        string text = encoding.GetString(bytes);
        int nullIndex = text.IndexOf('\0');
        return nullIndex >= 0 ? text[..nullIndex] : text;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool OpenClipboard(IntPtr hWndNewOwner);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool CloseClipboard();

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint EnumClipboardFormats(uint format);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int GetClipboardFormatName(uint format, StringBuilder lpszFormatName, int cchMaxCount);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr GetClipboardData(uint uFormat);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GlobalLock(IntPtr hMem);

    [DllImport("kernel32.dll")]
    private static extern bool GlobalUnlock(IntPtr hMem);

    [DllImport("kernel32.dll")]
    private static extern UIntPtr GlobalSize(IntPtr hMem);

    private void ClearDisplayButton_Clicked(object? sender, EventArgs e)
    {
        ClipboardLinkEditor.Text = string.Empty;
        ClipboardDumpEditor.Text = string.Empty;
        ShowApplicationsStatus("Display cleared.");
    }

    private void WordWrapCheckBox_CheckedChanged(object? sender, CheckedChangedEventArgs e)
    {
        if (ClipboardDumpEditor.Handler?.PlatformView is Microsoft.UI.Xaml.Controls.TextBox textBox)
        {
            textBox.TextWrapping = e.Value
                ? Microsoft.UI.Xaml.TextWrapping.Wrap
                : Microsoft.UI.Xaml.TextWrapping.NoWrap;
        }

        ShowApplicationsStatus(e.Value ? "Word wrap enabled." : "Word wrap disabled.");
    }

    private void SetDateContextButton_Clicked(object? sender, EventArgs e)
    {
        if (!TryParseDateToken(ManualDateEntry.Text, out string? dateToken))
        {
            ShowApplicationsStatus("Invalid date context. Use yyyymmdd or yyyymmdd DayName.", true);
            return;
        }

        _currentDateToken = dateToken;
        ManualDateEntry.Text = dateToken;
        ClipboardLinkEditor.Text = BuildOneNoteLinkDisplay(null);
        ShowApplicationsStatus($"Date context set to {_currentDateToken}.");
    }

    private void WriteToExcelButton_Clicked(object? sender, EventArgs e)
    {
        try
        {
            ClipboardSnapshot snapshot = CaptureClipboardSnapshot();
            ProcessClipboardSnapshot(snapshot, writeToExcel: true);
        }
        catch (Exception ex)
        {
            ShowApplicationsStatus($"Write to Excel failed: {ex.Message}", true);
        }
    }

    private void ProcessClipboardSnapshot(ClipboardSnapshot snapshot, bool writeToExcel)
    {
        bool dateWasDetected = TryParseDateToken(snapshot.PlainText, out string? detectedDate);
        if (dateWasDetected)
        {
            _currentDateToken = detectedDate;
            ManualDateEntry.Text = detectedDate;
        }

        var paragraph = TryExtractParagraphData(snapshot.PlainText, snapshot.Html, snapshot.OneNoteLinkRaw);
        ClipboardLinkEditor.Text = BuildOneNoteLinkDisplay(paragraph);
        ClipboardDumpEditor.Text = BuildClipboardDump(snapshot);

        if (!writeToExcel || dateWasDetected)
        {
            ShowApplicationsStatus(dateWasDetected
                ? $"Date context updated to {_currentDateToken}."
                : "Clipboard read complete.");
            return;
        }

        if (string.IsNullOrWhiteSpace(_currentDateToken))
        {
            ShowApplicationsStatus("Date context is required before writing to Excel. Copy or enter a date context, then try again.", true);
            return;
        }

        if (paragraph is null)
        {
            if (TryUpdateExistingParagraphFromFullText(snapshot.PlainText, _currentDateToken, out string updateStatus))
            {
                ShowApplicationsStatus(updateStatus);
                return;
            }

            ShowApplicationsStatus(NoOneNoteLinkMessage, true);
            return;
        }

        if (!TryWriteToApplicationsTable(paragraph.Value, _currentDateToken, out string errorMessage, out bool duplicate, out bool updatedExistingText))
        {
            ShowApplicationsStatus(errorMessage, true);
            return;
        }

        ShowApplicationsStatus(duplicate
            ? updatedExistingText
                ? "Duplicate paragraph detected. Existing row text was updated."
                : "Duplicate paragraph detected for the current date. Row was not added."
            : "Added a new row to Applications and wrote the OneNote link.");
    }

    private static bool TryUpdateExistingParagraphFromFullText(string? clipboardText, string dateToken, out string statusMessage)
    {
        statusMessage = string.Empty;
        string fullText = NormalizeParagraphText(clipboardText ?? string.Empty);
        if (string.IsNullOrWhiteSpace(fullText)
            || TryParseDateToken(fullText, out _)
            || fullText.StartsWith("onenote:", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        object? excelObject = null;
        object? workbookObject = null;
        object? worksheetObject = null;
        object? tableObject = null;
        object? columnsObject = null;
        object? rangeObject = null;
        object? cellObject = null;
        try
        {
            if (!TryGetActiveComObject("Excel.Application", out excelObject) || excelObject is null)
            {
                return false;
            }

            dynamic excel = excelObject;
            workbookObject = excel.ActiveWorkbook;
            if (workbookObject is null || !TryFindTableByName((dynamic)workbookObject, "Applications", out tableObject, out worksheetObject))
            {
                return false;
            }

            dynamic table = tableObject!;
            columnsObject = table.ListColumns;
            dynamic columns = columnsObject;
            int linkColumn = GetColumnIndex(columns, "OneNote Link");
            int? dateColumn = TryGetColumnIndex(columns, "Date");
            rangeObject = table.DataBodyRange;
            if (rangeObject is null)
            {
                return false;
            }

            dynamic range = rangeObject;
            int rowCount = (int)range.Rows.Count;
            for (int rowIndex = rowCount; rowIndex >= 1; rowIndex--)
            {
                if (dateColumn.HasValue && !RowMatchesDate(range, rowIndex, dateColumn.Value, dateToken))
                {
                    continue;
                }

                cellObject = range.Cells[rowIndex, linkColumn];
                dynamic cell = cellObject;
                string existingText = NormalizeParagraphText(Convert.ToString(cell.Text) ?? string.Empty);
                if (string.IsNullOrWhiteSpace(existingText)
                    || fullText.Length <= existingText.Length
                    || !fullText.StartsWith(existingText, StringComparison.Ordinal))
                {
                    ReleaseComObject(cellObject);
                    cellObject = null;
                    continue;
                }

                cell.Value2 = NormalizeFirstLine(fullText);
                statusMessage = "Updated the most recent matching entry with full paragraph text.";
                return true;
            }

            return false;
        }
        finally
        {
            ReleaseComObject(cellObject);
            ReleaseComObject(rangeObject);
            ReleaseComObject(columnsObject);
            ReleaseComObject(tableObject);
            ReleaseComObject(worksheetObject);
            ReleaseComObject(workbookObject);
            ReleaseComObject(excelObject);
        }
    }

    private static bool TryWriteToApplicationsTable(
        (string Link, string Text) paragraph,
        string dateToken,
        out string errorMessage,
        out bool duplicate,
        out bool updatedExistingText)
    {
        errorMessage = string.Empty;
        duplicate = false;
        updatedExistingText = false;
        object? excelObject = null;
        object? workbookObject = null;
        object? worksheetObject = null;
        object? tableObject = null;
        object? columnsObject = null;
        object? rowsObject = null;
        object? newRowObject = null;
        object? newRangeObject = null;
        object? previousRowObject = null;
        object? previousRangeObject = null;

        try
        {
            if (!TryGetActiveComObject("Excel.Application", out excelObject) || excelObject is null)
            {
                errorMessage = "Excel is not running. Open Excel and select a cell before trying again.";
                return false;
            }

            dynamic excel = excelObject;
            workbookObject = excel.ActiveWorkbook;
            if (workbookObject is null)
            {
                errorMessage = "No active workbook was found in Excel.";
                return false;
            }

            dynamic workbook = workbookObject;
            if (!TryFindTableByName(workbook, "Applications", out tableObject, out worksheetObject))
            {
                errorMessage = "Could not find a table named 'Applications' in the active workbook.";
                return false;
            }

            dynamic table = tableObject!;
            dynamic worksheet = worksheetObject!;
            worksheet.Activate();
            columnsObject = table.ListColumns;
            dynamic columns = columnsObject;
            int linkColumn = GetColumnIndex(columns, "OneNote Link");
            object? dataBodyRangeObject = table.DataBodyRange;
            try
            {
                if (dataBodyRangeObject is not null)
                {
                    dynamic dataBodyRange = dataBodyRangeObject;
                    int? dateColumn = TryGetColumnIndex(columns, "Date");
                    bool checkedAnyDateRows = false;
                    int rowCount = (int)dataBodyRange.Rows.Count;
                    string candidateKey = BuildParagraphKey(paragraph.Link);
                    for (int rowIndex = 1; rowIndex <= rowCount; rowIndex++)
                    {
                        if (dateColumn.HasValue)
                        {
                            if (!RowMatchesDate(dataBodyRange, rowIndex, dateColumn.Value, dateToken))
                            {
                                continue;
                            }

                            checkedAnyDateRows = true;
                        }

                        if (RowHasMatchingParagraph(dataBodyRange, rowIndex, linkColumn, candidateKey, paragraph.Text, out bool textDifferent))
                        {
                            duplicate = true;
                            if (textDifferent)
                            {
                                UpdateParagraphText(dataBodyRange, rowIndex, linkColumn, paragraph.Text);
                                updatedExistingText = true;
                            }

                            return true;
                        }
                    }

                    if (dateColumn.HasValue && !checkedAnyDateRows)
                    {
                        for (int rowIndex = 1; rowIndex <= rowCount; rowIndex++)
                        {
                            if (RowHasMatchingParagraph(dataBodyRange, rowIndex, linkColumn, candidateKey, paragraph.Text, out bool textDifferent))
                            {
                                duplicate = true;
                                if (textDifferent)
                                {
                                    UpdateParagraphText(dataBodyRange, rowIndex, linkColumn, paragraph.Text);
                                    updatedExistingText = true;
                                }

                                return true;
                            }
                        }
                    }
                }
            }
            finally
            {
                ReleaseComObject(dataBodyRangeObject);
            }

            rowsObject = table.ListRows;
            dynamic rows = rowsObject;
            newRowObject = rows.Add();
            dynamic newRow = newRowObject;
            newRangeObject = newRow.Range;
            dynamic newRange = newRangeObject;
            int newRowIndex = (int)newRow.Index;
            SetHyperlinkCell(worksheet, newRange, linkColumn, paragraph);

            if (newRowIndex <= 1)
            {
                errorMessage = "A row was added, but the table has no previous row from which to copy formulas.";
                return false;
            }

            previousRowObject = rows.Item(newRowIndex - 1);
            dynamic previousRow = previousRowObject;
            previousRangeObject = previousRow.Range;
            dynamic previousRange = previousRangeObject;
            CopyFormulaFromPreviousRow(columns, previousRange, newRange, "Date");
            CopyFormulaFromPreviousRow(columns, previousRange, newRange, "Day of Week");
            CopyFormulaFromPreviousRow(columns, previousRange, newRange, "Company");
            CopyFormulaFromPreviousRow(columns, previousRange, newRange, "Job");
            IncrementFromPreviousRow(columns, previousRange, newRange, "Application Number");
            SetCellRawValue(columns, newRange, "Date", dateToken);
            return true;
        }
        catch (COMException ex)
        {
            errorMessage = $"Excel COM error: {ex.Message}";
            return false;
        }
        catch (Exception ex)
        {
            errorMessage = $"Unexpected Excel error: {ex.Message}";
            return false;
        }
        finally
        {
            ReleaseComObject(previousRangeObject);
            ReleaseComObject(previousRowObject);
            ReleaseComObject(newRangeObject);
            ReleaseComObject(newRowObject);
            ReleaseComObject(rowsObject);
            ReleaseComObject(columnsObject);
            ReleaseComObject(tableObject);
            ReleaseComObject(worksheetObject);
            ReleaseComObject(workbookObject);
            ReleaseComObject(excelObject);
        }
    }

    private static int? TryGetColumnIndex(dynamic columns, string name)
    {
        try
        {
            return GetColumnIndex(columns, name);
        }
        catch
        {
            return null;
        }
    }

    private static bool RowMatchesDate(dynamic range, int rowIndex, int columnIndex, string dateToken)
    {
        object? cellObject = null;
        try
        {
            cellObject = range.Cells[rowIndex, columnIndex];
            dynamic cell = cellObject;
            return string.Equals(NormalizeDateToken(Convert.ToString(cell.Value2)), dateToken, StringComparison.OrdinalIgnoreCase)
                || string.Equals(NormalizeDateToken(Convert.ToString(cell.Text)), dateToken, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            ReleaseComObject(cellObject);
        }
    }

    private static bool RowHasMatchingParagraph(dynamic range, int rowIndex, int linkColumn, string candidateKey, string candidateText, out bool textDifferent)
    {
        textDifferent = false;
        object? cellObject = null;
        object? hyperlinksObject = null;
        object? hyperlinkObject = null;
        try
        {
            cellObject = range.Cells[rowIndex, linkColumn];
            dynamic cell = cellObject;
            hyperlinksObject = cell.Hyperlinks;
            dynamic hyperlinks = hyperlinksObject;
            if ((int)hyperlinks.Count > 0)
            {
                hyperlinkObject = hyperlinks.Item(1);
                dynamic hyperlink = hyperlinkObject;
                if (ParagraphKeyMatches(Convert.ToString(hyperlink.Address), candidateKey)
                    || ParagraphKeyMatches(Convert.ToString(hyperlink.SubAddress), candidateKey))
                {
                    textDifferent = IsDifferentParagraphText(Convert.ToString(cell.Text), candidateText);
                    return true;
                }
            }

            bool matches = ParagraphKeyMatches(Convert.ToString(cell.Formula), candidateKey)
                || ParagraphKeyMatches(Convert.ToString(cell.Value2), candidateKey);
            textDifferent = matches && IsDifferentParagraphText(Convert.ToString(cell.Text), candidateText);
            return matches;
        }
        finally
        {
            ReleaseComObject(hyperlinkObject);
            ReleaseComObject(hyperlinksObject);
            ReleaseComObject(cellObject);
        }
    }

    private static bool IsDifferentParagraphText(string? existingText, string? candidateText) => !string.IsNullOrWhiteSpace(candidateText)
            && !string.Equals(NormalizeFirstLine(existingText), NormalizeFirstLine(candidateText), StringComparison.OrdinalIgnoreCase);

    private static void UpdateParagraphText(dynamic range, int rowIndex, int linkColumn, string text)
    {
        object? cellObject = null;
        try
        {
            cellObject = range.Cells[rowIndex, linkColumn];
            dynamic cell = cellObject;
            cell.Value2 = NormalizeFirstLine(text);
        }
        finally
        {
            ReleaseComObject(cellObject);
        }
    }

    private static string NormalizeFirstLine(string? text)
    {
        string normalized = WebUtility.HtmlDecode(text ?? string.Empty).Trim();
        int newlineIndex = normalized.IndexOfAny(['\r', '\n']);
        return newlineIndex >= 0 ? normalized[..newlineIndex].TrimEnd() : normalized;
    }

    private static bool ParagraphKeyMatches(string? value, string candidateKey)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        string normalizedValue = NormalizeLinkValue(value);
        Match objectIdMatch = Regex.Match(normalizedValue, "object-id=(?:\\{|%7b)(?<id>[^}\\%]+)(?:\\}|%7d)", RegexOptions.IgnoreCase);
        if (objectIdMatch.Success && candidateKey.StartsWith("object-id:", StringComparison.OrdinalIgnoreCase))
        {
            return string.Equals(
                $"object-id:{objectIdMatch.Groups["id"].Value}",
                candidateKey,
                StringComparison.OrdinalIgnoreCase);
        }

        foreach (Match match in OneNoteLinkRegex.Matches(value))
        {
            if (string.Equals(BuildParagraphKey(match.Value), candidateKey, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return value.StartsWith("onenote:", StringComparison.OrdinalIgnoreCase)
            && string.Equals(BuildParagraphKey(value), candidateKey, StringComparison.OrdinalIgnoreCase);
    }

    private static string BuildParagraphKey(string link)
    {
        string normalized = NormalizeLinkValue(link);
        Match objectId = Regex.Match(normalized, "object-id=(?:\\{|%7b)(?<id>[^}\\%]+)(?:\\}|%7d)", RegexOptions.IgnoreCase);
        return objectId.Success
            ? $"object-id:{objectId.Groups["id"].Value.ToLowerInvariant()}"
            : $"link:{normalized.ToLowerInvariant()}";
    }

    private static string NormalizeLinkValue(string value) =>
        Uri.UnescapeDataString(WebUtility.HtmlDecode(value).Trim());

    private static string NormalizeParagraphText(string text) => WebUtility.HtmlDecode(text).Trim();

    private static string? NormalizeDateToken(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        Match match = Regex.Match(input.Trim(), "^(?<date>\\d{8})");
        return match.Success ? match.Groups["date"].Value : null;
    }

    private static bool TryFindTableByName(dynamic workbook, string tableName, out object? tableObject, out object? worksheetObject)
    {
        tableObject = null;
        worksheetObject = null;
        object? worksheetsObject = null;
        try
        {
            worksheetsObject = workbook.Worksheets;
            dynamic worksheets = worksheetsObject;
            for (int worksheetIndex = 1; worksheetIndex <= (int)worksheets.Count; worksheetIndex++)
            {
                object? currentWorksheetObject = null;
                object? listObjectsObject = null;
                try
                {
                    currentWorksheetObject = worksheets.Item(worksheetIndex);
                    dynamic currentWorksheet = currentWorksheetObject;
                    listObjectsObject = currentWorksheet.ListObjects;
                    dynamic listObjects = listObjectsObject;
                    for (int tableIndex = 1; tableIndex <= (int)listObjects.Count; tableIndex++)
                    {
                        object? currentTableObject = null;
                        try
                        {
                            currentTableObject = listObjects.Item(tableIndex);
                            dynamic currentTable = currentTableObject;
                            if (string.Equals(Convert.ToString(currentTable.Name), tableName, StringComparison.OrdinalIgnoreCase))
                            {
                                tableObject = currentTableObject;
                                worksheetObject = currentWorksheetObject;
                                currentTableObject = null;
                                currentWorksheetObject = null;
                                return true;
                            }
                        }
                        finally
                        {
                            ReleaseComObject(currentTableObject);
                        }
                    }
                }
                finally
                {
                    ReleaseComObject(listObjectsObject);
                    ReleaseComObject(currentWorksheetObject);
                }
            }

            return false;
        }
        finally
        {
            ReleaseComObject(worksheetsObject);
        }
    }

    private static int GetColumnIndex(dynamic columns, string name)
    {
        object? columnObject = null;
        try
        {
            columnObject = columns.Item(name);
            dynamic column = columnObject;
            return (int)column.Index;
        }
        finally
        {
            ReleaseComObject(columnObject);
        }
    }

    private static void SetHyperlinkCell(dynamic worksheet, dynamic range, int columnIndex, (string Link, string Text) paragraph)
    {
        object? cellObject = null;
        object? hyperlinksObject = null;
        try
        {
            cellObject = range.Cells[1, columnIndex];
            dynamic cell = cellObject;
            cell.Value2 = paragraph.Text;
            cell.Hyperlinks.Delete();
            hyperlinksObject = worksheet.Hyperlinks;
            dynamic hyperlinks = hyperlinksObject;
            hyperlinks.Add(cell, paragraph.Link, Type.Missing, Type.Missing, paragraph.Text);
        }
        finally
        {
            ReleaseComObject(hyperlinksObject);
            ReleaseComObject(cellObject);
        }
    }

    private static void IncrementFromPreviousRow(dynamic columns, dynamic previousRange, dynamic newRange, string name)
    {
        object? previousCellObject = null;
        object? newCellObject = null;
        try
        {
            int columnIndex = GetColumnIndex(columns, name);
            previousCellObject = previousRange.Cells[1, columnIndex];
            newCellObject = newRange.Cells[1, columnIndex];
            dynamic previousCell = previousCellObject;
            dynamic newCell = newCellObject;
            if (previousCell.Value2 is double previousValue)
            {
                newCell.Value2 = previousValue + 1;
            }
        }
        finally
        {
            ReleaseComObject(newCellObject);
            ReleaseComObject(previousCellObject);
        }
    }

    private static void CopyFormulaFromPreviousRow(dynamic columns, dynamic previousRange, dynamic newRange, string name)
    {
        object? previousCellObject = null;
        object? newCellObject = null;
        try
        {
            int columnIndex = GetColumnIndex(columns, name);
            previousCellObject = previousRange.Cells[1, columnIndex];
            newCellObject = newRange.Cells[1, columnIndex];
            dynamic previousCell = previousCellObject;
            dynamic newCell = newCellObject;
            if ((bool)previousCell.HasFormula)
            {
                newCell.FormulaR1C1 = previousCell.FormulaR1C1;
            }
        }
        finally
        {
            ReleaseComObject(newCellObject);
            ReleaseComObject(previousCellObject);
        }
    }

    private static void SetCellRawValue(dynamic columns, dynamic range, string name, string value)
    {
        object? cellObject = null;
        try
        {
            cellObject = range.Cells[1, GetColumnIndex(columns, name)];
            dynamic cell = cellObject;
            cell.Value2 = value;
        }
        finally
        {
            ReleaseComObject(cellObject);
        }
    }

    private static void ReleaseComObject(object? value)
    {
        if (value is not null && Marshal.IsComObject(value))
        {
            Marshal.ReleaseComObject(value);
        }
    }

    private static bool TryGetActiveComObject(string progId, out object? value)
    {
        value = null;
        if (CLSIDFromProgID(progId, out Guid clsid) != 0
            || GetActiveObject(ref clsid, IntPtr.Zero, out IntPtr unknown) != 0
            || unknown == IntPtr.Zero)
        {
            return false;
        }

        try
        {
            value = Marshal.GetObjectForIUnknown(unknown);
            return true;
        }
        finally
        {
            Marshal.Release(unknown);
        }
    }

    [DllImport("ole32.dll", CharSet = CharSet.Unicode)]
    private static extern int CLSIDFromProgID(string progId, out Guid clsid);

    [DllImport("oleaut32.dll")]
    private static extern int GetActiveObject(ref Guid clsid, IntPtr reserved, out IntPtr ppunk);

    private void ReadClipboardAndDisplay(ClipboardSnapshot snapshot)
    {
        if (TryParseDateToken(snapshot.PlainText, out string? detectedDate))
        {
            _currentDateToken = detectedDate;
            ManualDateEntry.Text = detectedDate;
        }

        var paragraph = TryExtractParagraphData(snapshot.PlainText, snapshot.Html, snapshot.OneNoteLinkRaw);
        ClipboardLinkEditor.Text = BuildOneNoteLinkDisplay(paragraph);
        ClipboardDumpEditor.Text = BuildClipboardDump(snapshot);
        ShowApplicationsStatus("Clipboard read complete.");
    }

    private string BuildOneNoteLinkDisplay((string Link, string Text)? paragraph)
    {
        var builder = new StringBuilder();
        builder.AppendLine("Date:");
        builder.AppendLine(string.IsNullOrWhiteSpace(_currentDateToken) ? "(not set)" : _currentDateToken);
        builder.AppendLine();

        if (paragraph is null)
        {
            builder.AppendLine(NoOneNoteLinkMessage);
            return builder.ToString();
        }

        builder.AppendLine("Paragraph text:");
        builder.AppendLine(string.IsNullOrWhiteSpace(paragraph.Value.Text) ? "(No paragraph text found)" : paragraph.Value.Text);
        builder.AppendLine();
        builder.AppendLine("Paragraph link:");
        builder.AppendLine(paragraph.Value.Link);
        return builder.ToString();
    }

    private static string BuildClipboardDump(ClipboardSnapshot snapshot)
    {
        var builder = new StringBuilder();
        builder.AppendLine($"Captured at {snapshot.Timestamp:O}");
        builder.AppendLine();

        if (snapshot.Formats.Count == 0)
        {
            builder.AppendLine("No clipboard formats were returned.");
            return builder.ToString();
        }

        builder.AppendLine($"Formats ({snapshot.Formats.Count}):");
        foreach (string format in snapshot.Formats)
        {
            builder.Append("- ").AppendLine(format);
        }

        foreach (ClipboardFormatEntry entry in snapshot.Entries)
        {
            builder.AppendLine();
            builder.AppendLine(new string('=', 100));
            builder.Append("Format: ").AppendLine(entry.Format);
            builder.AppendLine(new string('-', 100));

            if (entry.Error is not null)
            {
                builder.Append("Error: ").Append(entry.Error.GetType().Name).Append(": ").AppendLine(entry.Error.Message);
                continue;
            }

            AppendValue(builder, entry.Value);
        }

        return builder.ToString();
    }

    private static void AppendValue(StringBuilder builder, object? value)
    {
        if (value is null)
        {
            builder.AppendLine("(null)");
            return;
        }

        builder.Append("Type: ").AppendLine(value.GetType().FullName ?? value.GetType().Name);

        switch (value)
        {
            case string text:
                builder.AppendLine("Content:");
                builder.AppendLine(text);
                return;
            case string[] parts:
                builder.AppendLine("Content:");
                for (int i = 0; i < parts.Length; i++)
                {
                    builder.Append('[').Append(i).Append("] ").AppendLine(parts[i]);
                }

                return;
            case byte[] bytes:
                AppendBytes(builder, bytes);
                return;
            case MemoryStream memoryStream:
                AppendBytes(builder, memoryStream.ToArray());
                return;
            case System.Collections.IDictionary dictionary:
                builder.AppendLine("Dictionary content:");
                foreach (object key in dictionary.Keys)
                {
                    if (key is null)
                    {
                        builder.AppendLine("- (null) = (null key is not indexable)");
                        continue;
                    }

                    builder.Append("- ").Append(key.ToString()).Append(" = ")
                        .AppendLine(dictionary[key]?.ToString() ?? "(null)");
                }

                return;
            case System.Collections.IEnumerable list:
                builder.AppendLine("Enumerable content:");
                int index = 0;
                foreach (object? item in list)
                {
                    builder.Append('[').Append(index++).Append("] ").AppendLine(item?.ToString() ?? "(null)");
                }

                return;
            default:
                builder.AppendLine("Content:");
                builder.AppendLine(value.ToString() ?? "(null)");
                return;
        }
    }

    // Binary formats (e.g. "DataObject", "Ole Private Data") often contain embedded NUL bytes; the
    // underlying native TextBox truncates its displayed text at the first NUL, so control chars are sanitized.
    private static void AppendBytes(StringBuilder builder, byte[] bytes)
    {
        builder.Append("Byte length: ").AppendLine(bytes.Length.ToString());
        builder.AppendLine("UTF-8 interpretation:");
        builder.AppendLine(SanitizeControlCharacters(Encoding.UTF8.GetString(bytes)));
        builder.AppendLine();
        builder.AppendLine("Base64:");
        builder.AppendLine(Convert.ToBase64String(bytes));
    }

    private static string SanitizeControlCharacters(string text)
    {
        Span<char> buffer = text.Length <= 1024 ? stackalloc char[text.Length] : new char[text.Length];
        for (int i = 0; i < text.Length; i++)
        {
            char c = text[i];
            buffer[i] = char.IsControl(c) && c is not '\r' and not '\n' and not '\t' ? '.' : c;
        }

        return new string(buffer);
    }


    private static (string Link, string Text)? TryExtractParagraphData(string? text, string? html = null, string? customOneNoteLink = null)
    {
        if (!string.IsNullOrWhiteSpace(customOneNoteLink))
        {
            Match customAnchorMatch = AnchorRegex.Match(customOneNoteLink);
            if (customAnchorMatch.Success)
            {
                string customLink = WebUtility.HtmlDecode(customAnchorMatch.Groups["href"].Value);
                string customText = WebUtility.HtmlDecode(customAnchorMatch.Groups["text"].Value);
                customText = Regex.Replace(customText, "<.*?>", string.Empty).Trim();
                if (!string.IsNullOrWhiteSpace(customLink))
                {
                    return (customLink, customText);
                }
            }
            else
            {
                Match customOneNoteMatch = OneNoteLinkRegex.Match(customOneNoteLink);
                if (customOneNoteMatch.Success)
                {
                    string customLink = WebUtility.HtmlDecode(customOneNoteMatch.Groups["href"].Value);
                    if (!string.IsNullOrWhiteSpace(customLink))
                    {
                        return (customLink, customLink);
                    }
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(html))
        {
            Match htmlAnchorMatch = AnchorRegex.Match(html);
            if (htmlAnchorMatch.Success)
            {
                string htmlLink = WebUtility.HtmlDecode(htmlAnchorMatch.Groups["href"].Value);
                string htmlParagraphText = WebUtility.HtmlDecode(htmlAnchorMatch.Groups["text"].Value);
                htmlParagraphText = Regex.Replace(htmlParagraphText, "<.*?>", string.Empty).Trim();
                if (!string.IsNullOrWhiteSpace(htmlLink))
                {
                    return (htmlLink, htmlParagraphText);
                }
            }
        }

        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        Match anchorMatch = AnchorRegex.Match(text);
        if (anchorMatch.Success)
        {
            string link = WebUtility.HtmlDecode(anchorMatch.Groups["href"].Value);
            string paragraphText = WebUtility.HtmlDecode(anchorMatch.Groups["text"].Value);
            paragraphText = Regex.Replace(paragraphText, "<.*?>", string.Empty).Trim();
            return string.IsNullOrWhiteSpace(link) ? null : (link, paragraphText);
        }

        Match oneNoteMatch = OneNoteLinkRegex.Match(text);
        if (!oneNoteMatch.Success)
        {
            return null;
        }

        string oneNoteLink = WebUtility.HtmlDecode(oneNoteMatch.Groups["href"].Value);
        return string.IsNullOrWhiteSpace(oneNoteLink) ? null : (oneNoteLink, oneNoteLink);
    }

    private static bool TryParseDateToken(string? input, out string? dateToken)
    {
        dateToken = null;
        if (string.IsNullOrWhiteSpace(input))
        {
            return false;
        }

        Match match = DateClipboardRegex.Match(input.Trim());
        if (!match.Success)
        {
            return false;
        }

        dateToken = match.Groups["date"].Value;
        return true;
    }

    private void ShowApplicationsStatus(string message, bool isError = false)
    {
        OneNoteStatusLabel.Text = $"Status: {message}";
        OneNoteStatusLabel.TextColor = isError ? Colors.Firebrick : Colors.DarkGreen;
        ApplicationsStatusLabel.Text = message;
        ApplicationsStatusLabel.TextColor = isError ? Colors.Firebrick : Colors.Gray;
    }

    private sealed record ClipboardFormatEntry(string Format, object? Value, Exception? Error);

    private sealed record ClipboardSnapshot(
        DateTime Timestamp,
        IReadOnlyList<string> Formats,
        IReadOnlyList<ClipboardFormatEntry> Entries,
        string? PlainText,
        string? Html,
        string? OneNoteLinkRaw);
}