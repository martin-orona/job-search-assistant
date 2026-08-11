using System.Windows;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Interop;
using System.Windows.Media.Imaging;

namespace JobSearchAssistant.Ui;

/// <summary>
/// Interaction logic for MainWindow.xaml
/// </summary>
public partial class MainWindow : Window
{
    private const string NoOneNoteLinkMessage = "The clipboard doesn't contain a OneNote Link. Please copy the link to a paragraph and try again.";
    private const int WM_CLIPBOARDUPDATE = 0x031D;
    private static readonly Regex DateClipboardRegex = new("^(?<date>\\d{8})(?:\\s+[A-Za-z]+)?$", RegexOptions.Compiled);

    private sealed record OneNoteParagraphData(string ParagraphLink, string ParagraphText);
    private sealed record DuplicateMatchInfo(int RowIndex, bool ParagraphTextDifferent);
    private HwndSource? _windowSource;
    private bool _isListeningMode;
    private bool _isClipboardWriteInProgress;
    private uint _lastClipboardSequenceNumber;
    private string? _currentDateToken;
    private readonly string _windowStateFilePath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "JobSearchAssistant",
        "window-state.json");

    public MainWindow()
    {
        InitializeComponent();
        ApplyWordWrap(true);
        SourceInitialized += MainWindow_SourceInitialized;
        Loaded += MainWindow_Loaded;
    }

    private sealed record WindowPlacement(double Left, double Top, double Width, double Height, WindowState WindowState);

    private void ShowClipboardButton_Click(object sender, RoutedEventArgs e)
    {
        TryUpdateCurrentDateFromClipboard();
        ReadClipboardAndDisplay(out _);
    }

    private void WriteToExcelButton_Click(object sender, RoutedEventArgs e)
    {
        ExecuteWriteToExcel(fromListeningMode: false);
    }

    private void ListeningToggleButton_Checked(object sender, RoutedEventArgs e)
    {
        _isListeningMode = true;
        _lastClipboardSequenceNumber = GetClipboardSequenceNumber();

        if (sender is ToggleButton toggleButton)
        {
            toggleButton.Content = "Stop Listening";
        }

        UpdateStatus("Listening mode started.", false);
    }

    private void ListeningToggleButton_Unchecked(object sender, RoutedEventArgs e)
    {
        _isListeningMode = false;

        if (sender is ToggleButton toggleButton)
        {
            toggleButton.Content = "Start Listening";
        }

        UpdateStatus("Listening mode stopped.", false);
    }

    private void ClearDisplayButton_Click(object sender, RoutedEventArgs e)
    {
        ClipboardLinkTextBox.Clear();
        ClipboardDumpTextBox.Clear();
        ClipboardDumpTextBox.CaretIndex = 0;
        ClipboardDumpTextBox.Focus();
    }

    private void WordWrapCheckBox_Click(object sender, RoutedEventArgs e)
    {
        bool wrapEnabled = sender is CheckBox checkBox && checkBox.IsChecked == true;

        ApplyWordWrap(wrapEnabled);
    }

    private void SetDateContextButton_Click(object sender, RoutedEventArgs e)
    {
        if (!TryParseDateToken(ManualDateTextBox.Text, out string? manualDate))
        {
            UpdateStatus("Invalid date context. Use yyyymmdd or yyyymmdd DayName.", true);
            MessageBox.Show(
                "Invalid date context. Enter yyyymmdd or yyyymmdd DayName, for example 20260808 or 20260808 Saturday.",
                "Invalid Date Context",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
            return;
        }

        _currentDateToken = manualDate;
        ManualDateTextBox.Text = _currentDateToken;
        ClipboardLinkTextBox.Text = BuildOneNoteLinkDisplay(null);
        UpdateStatus($"Date context set to {_currentDateToken}.", false);
    }

    private void ApplyWordWrap(bool wrapEnabled)
    {
        ClipboardDumpTextBox.TextWrapping = wrapEnabled ? TextWrapping.Wrap : TextWrapping.NoWrap;
        ClipboardDumpTextBox.HorizontalScrollBarVisibility = wrapEnabled ? ScrollBarVisibility.Disabled : ScrollBarVisibility.Auto;
    }

    private void MainWindow_SourceInitialized(object? sender, EventArgs e)
    {
        IntPtr hwnd = new WindowInteropHelper(this).Handle;
        _windowSource = HwndSource.FromHwnd(hwnd);
        _windowSource?.AddHook(WndProc);
        AddClipboardFormatListener(hwnd);
    }

    private void MainWindow_Loaded(object sender, RoutedEventArgs e)
    {
        TryRestoreWindowPlacement();
    }

    protected override void OnClosing(System.ComponentModel.CancelEventArgs e)
    {
        SaveWindowPlacement();
        base.OnClosing(e);
    }

    protected override void OnClosed(EventArgs e)
    {
        if (_windowSource is not null)
        {
            RemoveClipboardFormatListener(_windowSource.Handle);
            _windowSource.RemoveHook(WndProc);
        }

        base.OnClosed(e);
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WM_CLIPBOARDUPDATE && _isListeningMode)
        {
            HandleClipboardUpdate();
        }

        return IntPtr.Zero;
    }

    private void HandleClipboardUpdate()
    {
        uint sequenceNumber = GetClipboardSequenceNumber();
        if (sequenceNumber == _lastClipboardSequenceNumber)
        {
            return;
        }

        _lastClipboardSequenceNumber = sequenceNumber;

        if (_isClipboardWriteInProgress)
        {
            return;
        }

        if (TryUpdateCurrentDateFromClipboard())
        {
            ClipboardLinkTextBox.Text = BuildOneNoteLinkDisplay(null);
            UpdateStatus($"Date context updated to {_currentDateToken}.", false);
            return;
        }

        _isClipboardWriteInProgress = true;
        Dispatcher.BeginInvoke(() =>
        {
            try
            {
                ExecuteWriteToExcel(fromListeningMode: true);
            }
            finally
            {
                _isClipboardWriteInProgress = false;
            }
        });
    }

    private bool ExecuteWriteToExcel(bool fromListeningMode)
    {
        UpdateStatus(fromListeningMode ? "Clipboard update detected. Writing to Excel..." : "Writing to Excel...", false);

        if (!ReadClipboardAndDisplay(out OneNoteParagraphData? paragraphData))
        {
            UpdateStatus("Clipboard read failed.", true);
            return false;
        }

        if (paragraphData is null)
        {
            string? clipboardText = GetClipboardPlainText();
            if (TryUpdateExistingParagraphFromFullText(clipboardText, _currentDateToken, out string fullTextUpdateStatus))
            {
                UpdateStatus(fullTextUpdateStatus, false);
                return true;
            }

            UpdateStatus("No OneNote link found in clipboard.", true);

            if (!fromListeningMode)
            {
                MessageBox.Show(
                    NoOneNoteLinkMessage,
                    "OneNote Link Not Found",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);
            }

            return false;
        }

        if (string.IsNullOrWhiteSpace(_currentDateToken))
        {
            UpdateStatus("Date context required. Copy or enter a date context before writing.", true);

            if (!fromListeningMode)
            {
                MessageBox.Show(
                    "Date context is required before writing to Excel. Copy a date in yyyymmdd format (optionally followed by day text), or enter it in Date Context and click Set Date.",
                    "Date Context Required",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);
            }

            return false;
        }

        if (!TryWriteToApplicationsTable(paragraphData, _currentDateToken, out string errorMessage, out bool skippedDuplicate, out bool updatedExistingText))
        {
            UpdateStatus("Write to Excel failed.", true);

            if (!fromListeningMode)
            {
                MessageBox.Show(
                    errorMessage,
                    "Write to Excel Failed",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }

            return false;
        }

        if (skippedDuplicate)
        {
            UpdateStatus(
                updatedExistingText
                    ? "Duplicate paragraph detected. Existing row text was updated."
                    : "Duplicate paragraph detected for the current date. Row was not added.",
                false);
            return true;
        }

        UpdateStatus(
            fromListeningMode
                ? "Listening mode: added a row to Applications."
                : "Added a new row to Applications and wrote the OneNote link.",
            false);

        return true;
    }

    private static bool TryUpdateExistingParagraphFromFullText(string? clipboardText, string? dateToken, out string statusMessage)
    {
        statusMessage = "No OneNote link found in clipboard.";

        string normalizedFullText = NormalizeParagraphText(clipboardText ?? string.Empty);
        normalizedFullText = TakeFirstLine(normalizedFullText);
        if (string.IsNullOrWhiteSpace(normalizedFullText))
        {
            return false;
        }

        if (TryParseDateToken(normalizedFullText, out _))
        {
            return false;
        }

        if (normalizedFullText.StartsWith("onenote:", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(dateToken))
        {
            statusMessage = "Date context required. Copy or enter a date context before writing.";
            return false;
        }

        object? excelAppObject = null;
        object? workbookObject = null;
        object? worksheetObject = null;
        object? tableObject = null;
        object? tableColumnsObject = null;
        object? dataBodyRangeObject = null;
        object? targetCellObject = null;

        try
        {
            if (!TryGetActiveComObject("Excel.Application", out excelAppObject) || excelAppObject is null)
            {
                return false;
            }

            dynamic excelApp = excelAppObject;
            workbookObject = excelApp.ActiveWorkbook;
            if (workbookObject is null)
            {
                return false;
            }

            dynamic workbook = workbookObject;
            if (!TryFindTableByName(workbook, "Applications", out tableObject, out worksheetObject))
            {
                return false;
            }

            dynamic table = tableObject!;
            tableColumnsObject = table.ListColumns;
            dynamic tableColumns = tableColumnsObject;

            int oneNoteLinkColumnIndex = GetColumnIndex(tableColumns, "OneNote Link");

            int? dateColumnIndex = null;
            try
            {
                dateColumnIndex = GetColumnIndex(tableColumns, "Date");
            }
            catch
            {
                dateColumnIndex = null;
            }

            dataBodyRangeObject = table.DataBodyRange;
            if (dataBodyRangeObject is null)
            {
                return false;
            }

            dynamic dataBodyRange = dataBodyRangeObject;
            int rowCount = (int)dataBodyRange.Rows.Count;
            if (rowCount <= 0)
            {
                return false;
            }

            int bestRowIndex = -1;
            int bestPrefixLength = -1;

            for (int rowIndex = 1; rowIndex <= rowCount; rowIndex++)
            {
                if (dateColumnIndex.HasValue && !RowMatchesDate(dataBodyRange, rowIndex, dateColumnIndex.Value, dateToken))
                {
                    continue;
                }

                if (RowIsPrefixCandidate(dataBodyRange, rowIndex, oneNoteLinkColumnIndex, normalizedFullText, out int prefixLength))
                {
                    if (prefixLength > bestPrefixLength)
                    {
                        bestPrefixLength = prefixLength;
                        bestRowIndex = rowIndex;
                    }
                }
            }

            if (bestRowIndex <= 0)
            {
                return false;
            }

            targetCellObject = dataBodyRange.Cells[bestRowIndex, oneNoteLinkColumnIndex];
            dynamic targetCell = targetCellObject;
            targetCell.Value2 = normalizedFullText;

            statusMessage = "Updated existing entry with full paragraph text.";
            return true;
        }
        finally
        {
            ReleaseComObject(targetCellObject);
            ReleaseComObject(dataBodyRangeObject);
            ReleaseComObject(tableColumnsObject);
            ReleaseComObject(tableObject);
            ReleaseComObject(worksheetObject);
            ReleaseComObject(workbookObject);
            ReleaseComObject(excelAppObject);
        }
    }

    private static bool RowIsPrefixCandidate(dynamic dataBodyRange, int rowIndex, int linkColumnIndex, string normalizedFullText, out int prefixLength)
    {
        prefixLength = 0;
        object? linkCellObject = null;

        try
        {
            linkCellObject = dataBodyRange.Cells[rowIndex, linkColumnIndex];
            dynamic linkCell = linkCellObject;
            string existingText = NormalizeParagraphText(Convert.ToString(linkCell.Text) ?? string.Empty);

            if (string.IsNullOrWhiteSpace(existingText))
            {
                return false;
            }

            if (normalizedFullText.Length <= existingText.Length)
            {
                return false;
            }

            if (!normalizedFullText.StartsWith(existingText, StringComparison.Ordinal))
            {
                return false;
            }

            prefixLength = existingText.Length;
            return true;
        }
        finally
        {
            ReleaseComObject(linkCellObject);
        }
    }

    private bool ReadClipboardAndDisplay(out OneNoteParagraphData? paragraphData)
    {
        paragraphData = null;

        IDataObject? dataObject;
        try
        {
            dataObject = Clipboard.GetDataObject();
        }
        catch (Exception ex)
        {
            ClipboardLinkTextBox.Text = NoOneNoteLinkMessage;
            ClipboardDumpTextBox.Text = $"Failed to read clipboard. {ex.GetType().Name}: {ex.Message}";
            ClipboardDumpTextBox.CaretIndex = 0;
            ClipboardDumpTextBox.ScrollToHome();
            UpdateStatus("Clipboard read failed.", true);
            return false;
        }

        if (dataObject is null)
        {
            ClipboardLinkTextBox.Text = NoOneNoteLinkMessage;
            ClipboardDumpTextBox.Text = "Clipboard is empty or unavailable.";
            ClipboardDumpTextBox.CaretIndex = 0;
            ClipboardDumpTextBox.ScrollToHome();
            UpdateStatus("Clipboard is empty.", true);
            return false;
        }

        paragraphData = TryExtractParagraphData(dataObject);
        ClipboardLinkTextBox.Text = BuildOneNoteLinkDisplay(paragraphData);
        ClipboardDumpTextBox.Text = BuildClipboardDump(dataObject);
        ClipboardDumpTextBox.CaretIndex = 0;
        ClipboardDumpTextBox.ScrollToHome();
        UpdateStatus("Clipboard read complete.", false);
        return true;
    }

    private void UpdateStatus(string message, bool isError)
    {
        OneNoteStatusTextBlock.Text = $"Status: {message}";
        OneNoteStatusTextBlock.Foreground = isError
            ? System.Windows.Media.Brushes.Firebrick
            : System.Windows.Media.Brushes.DarkGreen;
    }

    private static string BuildClipboardDump(IDataObject dataObject)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Captured at {DateTime.Now:O}");
        sb.AppendLine();

        string[] formats = dataObject.GetFormats(autoConvert: true);
        if (formats.Length == 0)
        {
            sb.AppendLine("No clipboard formats were returned.");
            return sb.ToString();
        }

        sb.AppendLine($"Formats ({formats.Length}):");
        foreach (string format in formats)
        {
            sb.Append("- ").AppendLine(format);
        }

        foreach (string format in formats)
        {
            sb.AppendLine();
            sb.AppendLine(new string('=', 100));
            sb.Append("Format: ").AppendLine(format);
            sb.AppendLine(new string('-', 100));

            object? value;
            try
            {
                value = dataObject.GetData(format, autoConvert: true);
            }
            catch (Exception ex)
            {
                sb.Append("Error: ").Append(ex.GetType().Name).Append(": ").AppendLine(ex.Message);
                continue;
            }

            AppendValue(sb, value);
        }

        return sb.ToString();
    }

    private string BuildOneNoteLinkDisplay(OneNoteParagraphData? paragraphData)
    {
        var sb = new StringBuilder();
        sb.AppendLine("Date:");
        sb.AppendLine(string.IsNullOrWhiteSpace(_currentDateToken) ? "(not set)" : _currentDateToken);
        sb.AppendLine();

        if (paragraphData is null)
        {
            sb.AppendLine(NoOneNoteLinkMessage);
            return sb.ToString();
        }

        sb.AppendLine("Paragraph text:");
        sb.AppendLine(string.IsNullOrWhiteSpace(paragraphData.ParagraphText) ? "(No paragraph text found)" : paragraphData.ParagraphText);
        sb.AppendLine();
        sb.AppendLine("Paragraph link:");
        sb.AppendLine(paragraphData.ParagraphLink);
        return sb.ToString();
    }

    private bool TryUpdateCurrentDateFromClipboard()
    {
        string? text = GetClipboardPlainText();
        if (!TryParseDateToken(text, out string? detectedDate))
        {
            return false;
        }

        if (detectedDate == _currentDateToken)
        {
            return false;
        }

        _currentDateToken = detectedDate;
        ManualDateTextBox.Text = _currentDateToken;
        return true;
    }

    private static bool TryParseDateToken(string? input, out string? dateToken)
    {
        dateToken = null;
        if (string.IsNullOrWhiteSpace(input))
        {
            return false;
        }

        Match dateMatch = DateClipboardRegex.Match(input.Trim());
        if (!dateMatch.Success)
        {
            return false;
        }

        dateToken = dateMatch.Groups["date"].Value;
        return !string.IsNullOrWhiteSpace(dateToken);
    }

    private static string? GetClipboardPlainText()
    {
        try
        {
            IDataObject? dataObject = Clipboard.GetDataObject();
            if (dataObject is null)
            {
                return null;
            }

            foreach (string format in new[] { DataFormats.UnicodeText, DataFormats.Text })
            {
                object? value = dataObject.GetData(format, autoConvert: true);
                if (value is string text && !string.IsNullOrWhiteSpace(text))
                {
                    return text;
                }
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    private static OneNoteParagraphData? TryExtractParagraphData(IDataObject dataObject)
    {
        foreach (string format in new[] { "OneNote Link", DataFormats.Html, DataFormats.Text, DataFormats.UnicodeText })
        {
            object? value;
            try
            {
                value = dataObject.GetData(format, autoConvert: true);
            }
            catch
            {
                continue;
            }

            if (value is not string text || string.IsNullOrWhiteSpace(text))
            {
                continue;
            }

            if (TryExtractParagraphData(text, out string? paragraphLink, out string? paragraphText))
            {
                string resolvedText = string.IsNullOrWhiteSpace(paragraphText) ? paragraphLink! : paragraphText;
                return new OneNoteParagraphData(paragraphLink!, resolvedText);
            }
        }

        return null;
    }

    private static bool TryExtractParagraphData(string text, out string? paragraphLink, out string? paragraphText)
    {
        paragraphLink = null;
        paragraphText = null;

        Match anchorMatch = Regex.Match(
            text,
            "<a\\b[^>]*\\bhref\\s*=\\s*\"(?<href>[^\"]+)\"[^>]*>(?<text>.*?)</a>",
            RegexOptions.IgnoreCase | RegexOptions.Singleline);

        if (anchorMatch.Success)
        {
            paragraphLink = WebUtility.HtmlDecode(anchorMatch.Groups["href"].Value);
            string rawText = WebUtility.HtmlDecode(anchorMatch.Groups["text"].Value);
            paragraphText = Regex.Replace(rawText, "<.*?>", string.Empty).Trim();
            return !string.IsNullOrWhiteSpace(paragraphLink);
        }

        Match oneNoteMatch = Regex.Match(text, "(?<href>onenote:[^\\s\"'<>]+)", RegexOptions.IgnoreCase);
        if (oneNoteMatch.Success)
        {
            paragraphLink = WebUtility.HtmlDecode(oneNoteMatch.Groups["href"].Value);
            return !string.IsNullOrWhiteSpace(paragraphLink);
        }

        return false;
    }

    private static bool TryWriteToApplicationsTable(
        OneNoteParagraphData paragraphData,
        string? dateToken,
        out string errorMessage,
        out bool skippedDuplicate,
        out bool updatedExistingText)
    {
        skippedDuplicate = false;
        updatedExistingText = false;

        object? excelAppObject = null;
        object? workbookObject = null;
        object? worksheetObject = null;
        object? tableObject = null;
        object? listRowsObject = null;
        object? newListRowObject = null;
        object? newRowRangeObject = null;
        object? previousListRowObject = null;
        object? previousRowRangeObject = null;
        object? tableColumnsObject = null;

        try
        {
            if (!TryGetActiveComObject("Excel.Application", out excelAppObject) || excelAppObject is null)
            {
                errorMessage = "Excel is not running. Open Excel and select a cell before trying again.";
                return false;
            }

            dynamic excelApp = excelAppObject;
            workbookObject = excelApp.ActiveWorkbook;
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

            tableColumnsObject = table.ListColumns;
            dynamic tableColumns = tableColumnsObject;

            DuplicateMatchInfo? duplicateMatch = FindDuplicateParagraph(table, tableColumns, paragraphData.ParagraphLink, paragraphData.ParagraphText, dateToken);
            if (duplicateMatch is not null)
            {
                if (duplicateMatch.ParagraphTextDifferent)
                {
                    UpdateDuplicateParagraphText(table, tableColumns, duplicateMatch.RowIndex, paragraphData);
                    updatedExistingText = true;
                }

                skippedDuplicate = true;
                errorMessage = string.Empty;
                return true;
            }

            listRowsObject = table.ListRows;
            dynamic listRows = listRowsObject;
            newListRowObject = listRows.Add();
            dynamic newListRow = newListRowObject;
            newRowRangeObject = newListRow.Range;
            dynamic newRowRange = newRowRangeObject;
            newRowRange.Select();

            int newRowIndex = (int)newListRow.Index;

            int oneNoteLinkColumnIndex = GetColumnIndex(tableColumns, "OneNote Link");
            SetHyperlinkCell(worksheet, newRowRange, oneNoteLinkColumnIndex, paragraphData);
            newRowRange.Select();

            if (newRowIndex > 1)
            {
                previousListRowObject = listRows.Item(newRowIndex - 1);
                dynamic previousListRow = previousListRowObject;
                previousRowRangeObject = previousListRow.Range;
                dynamic previousRowRange = previousRowRangeObject;

                CopyFormulaFromPreviousRow(tableColumns, previousRowRange, newRowRange, "Application Number");
                CopyFormulaFromPreviousRow(tableColumns, previousRowRange, newRowRange, "Date");
                CopyFormulaFromPreviousRow(tableColumns, previousRowRange, newRowRange, "Day of Week");
                CopyFormulaFromPreviousRow(tableColumns, previousRowRange, newRowRange, "Company");
                CopyFormulaFromPreviousRow(tableColumns, previousRowRange, newRowRange, "Job");
            }
            else
            {
                errorMessage = "A new row was added, but formulas could not be copied because there is no previous row in the table.";
                return false;
            }

            if (!string.IsNullOrWhiteSpace(dateToken))
            {
                SetCellRawValue(tableColumns, newRowRange, "Date", dateToken);
            }

            errorMessage = string.Empty;
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
            ReleaseComObject(tableColumnsObject);
            ReleaseComObject(previousRowRangeObject);
            ReleaseComObject(previousListRowObject);
            ReleaseComObject(newRowRangeObject);
            ReleaseComObject(newListRowObject);
            ReleaseComObject(listRowsObject);
            ReleaseComObject(tableObject);
            ReleaseComObject(worksheetObject);
            ReleaseComObject(workbookObject);
            ReleaseComObject(excelAppObject);
        }
    }

    private static DuplicateMatchInfo? FindDuplicateParagraph(dynamic table, dynamic tableColumns, string paragraphLink, string paragraphText, string? dateToken)
    {
        object? dataBodyRangeObject = null;

        try
        {
            dataBodyRangeObject = table.DataBodyRange;
            if (dataBodyRangeObject is null)
            {
                return null;
            }

            dynamic dataBodyRange = dataBodyRangeObject;
            int rowCount = (int)dataBodyRange.Rows.Count;
            if (rowCount <= 0)
            {
                return null;
            }

            int oneNoteLinkColumnIndex = GetColumnIndex(tableColumns, "OneNote Link");
            int? dateColumnIndex = null;
            bool checkedAnyDateRows = false;

            if (!string.IsNullOrWhiteSpace(dateToken))
            {
                try
                {
                    dateColumnIndex = GetColumnIndex(tableColumns, "Date");
                }
                catch
                {
                    dateColumnIndex = null;
                }
            }

            string candidateParagraphKey = BuildParagraphKey(paragraphLink);
            string candidateParagraphText = NormalizeParagraphText(paragraphText);

            for (int rowIndex = 1; rowIndex <= rowCount; rowIndex++)
            {
                if (dateColumnIndex.HasValue)
                {
                    if (!RowMatchesDate(dataBodyRange, rowIndex, dateColumnIndex.Value, dateToken!))
                    {
                        continue;
                    }

                    checkedAnyDateRows = true;
                }

                if (RowHasMatchingParagraph(dataBodyRange, rowIndex, oneNoteLinkColumnIndex, candidateParagraphKey, candidateParagraphText, out bool paragraphTextDifferent))
                {
                    return new DuplicateMatchInfo(rowIndex, paragraphTextDifferent);
                }
            }

            // Fallback: if date-scoped filtering had no matching rows, do a full scan to avoid false negatives.
            if (dateColumnIndex.HasValue && !checkedAnyDateRows)
            {
                for (int rowIndex = 1; rowIndex <= rowCount; rowIndex++)
                {
                    if (RowHasMatchingParagraph(dataBodyRange, rowIndex, oneNoteLinkColumnIndex, candidateParagraphKey, candidateParagraphText, out bool paragraphTextDifferent))
                    {
                        return new DuplicateMatchInfo(rowIndex, paragraphTextDifferent);
                    }
                }
            }

            return null;
        }
        finally
        {
            ReleaseComObject(dataBodyRangeObject);
        }
    }

    private static bool RowMatchesDate(dynamic dataBodyRange, int rowIndex, int dateColumnIndex, string dateToken)
    {
        object? dateCellObject = null;

        try
        {
            dateCellObject = dataBodyRange.Cells[rowIndex, dateColumnIndex];
            dynamic dateCell = dateCellObject;

            string? existingDateFromValue = NormalizeDateToken(Convert.ToString(dateCell.Value2));
            if (string.Equals(existingDateFromValue, dateToken, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            string? existingDateFromText = NormalizeDateToken(Convert.ToString(dateCell.Text));
            return string.Equals(existingDateFromText, dateToken, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            ReleaseComObject(dateCellObject);
        }
    }

    private static bool RowHasMatchingParagraph(
        dynamic dataBodyRange,
        int rowIndex,
        int linkColumnIndex,
        string candidateParagraphKey,
        string candidateParagraphText,
        out bool paragraphTextDifferent)
    {
        paragraphTextDifferent = false;
        object? linkCellObject = null;
        object? hyperlinksObject = null;
        object? hyperlinkObject = null;

        try
        {
            linkCellObject = dataBodyRange.Cells[rowIndex, linkColumnIndex];
            dynamic linkCell = linkCellObject;
            string existingText = NormalizeParagraphText(Convert.ToString(linkCell.Text) ?? string.Empty);

            hyperlinksObject = linkCell.Hyperlinks;
            dynamic hyperlinks = hyperlinksObject;
            int hyperlinkCount = (int)hyperlinks.Count;
            if (hyperlinkCount > 0)
            {
                hyperlinkObject = hyperlinks.Item(1);
                dynamic hyperlink = hyperlinkObject;

                if (ParagraphKeyMatches(Convert.ToString(hyperlink.Address), candidateParagraphKey))
                {
                    paragraphTextDifferent =
                        !string.IsNullOrWhiteSpace(candidateParagraphText)
                        && !string.Equals(existingText, candidateParagraphText, StringComparison.OrdinalIgnoreCase);
                    return true;
                }

                if (ParagraphKeyMatches(Convert.ToString(hyperlink.SubAddress), candidateParagraphKey))
                {
                    paragraphTextDifferent =
                        !string.IsNullOrWhiteSpace(candidateParagraphText)
                        && !string.Equals(existingText, candidateParagraphText, StringComparison.OrdinalIgnoreCase);
                    return true;
                }
            }

            if (ParagraphKeyMatches(Convert.ToString(linkCell.Formula), candidateParagraphKey))
            {
                paragraphTextDifferent =
                    !string.IsNullOrWhiteSpace(candidateParagraphText)
                    && !string.Equals(existingText, candidateParagraphText, StringComparison.OrdinalIgnoreCase);
                return true;
            }

            if (ParagraphKeyMatches(Convert.ToString(linkCell.Value2), candidateParagraphKey))
            {
                paragraphTextDifferent =
                    !string.IsNullOrWhiteSpace(candidateParagraphText)
                    && !string.Equals(existingText, candidateParagraphText, StringComparison.OrdinalIgnoreCase);
                return true;
            }

            return false;
        }
        finally
        {
            ReleaseComObject(hyperlinkObject);
            ReleaseComObject(hyperlinksObject);
            ReleaseComObject(linkCellObject);
        }
    }

    private static void UpdateDuplicateParagraphText(dynamic table, dynamic tableColumns, int rowIndex, OneNoteParagraphData paragraphData)
    {
        object? dataBodyRangeObject = null;
        object? cellObject = null;
        object? worksheetObject = null;

        try
        {
            dataBodyRangeObject = table.DataBodyRange;
            if (dataBodyRangeObject is null)
            {
                return;
            }

            int oneNoteLinkColumnIndex = GetColumnIndex(tableColumns, "OneNote Link");
            dynamic dataBodyRange = dataBodyRangeObject;
            cellObject = dataBodyRange.Cells[rowIndex, oneNoteLinkColumnIndex];
            dynamic cell = cellObject;

            worksheetObject = table.Parent;
            dynamic worksheet = worksheetObject;
            string updatedText = TakeFirstLine(NormalizeParagraphText(paragraphData.ParagraphText));
            var updatedData = new OneNoteParagraphData(paragraphData.ParagraphLink, updatedText);
            SetHyperlinkCell(worksheet, cell, 1, updatedData);
        }
        finally
        {
            ReleaseComObject(worksheetObject);
            ReleaseComObject(cellObject);
            ReleaseComObject(dataBodyRangeObject);
        }
    }

    private static bool ParagraphKeyMatches(string? value, string candidateParagraphKey)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        foreach (string link in ExtractOneNoteLinks(value))
        {
            if (string.Equals(BuildParagraphKey(link), candidateParagraphKey, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static IEnumerable<string> ExtractOneNoteLinks(string input)
    {
        foreach (Match match in Regex.Matches(input, "onenote:[^\\s\"'<>]+", RegexOptions.IgnoreCase))
        {
            string value = match.Value;
            if (!string.IsNullOrWhiteSpace(value))
            {
                yield return value;
            }
        }

        if (input.StartsWith("onenote:", StringComparison.OrdinalIgnoreCase))
        {
            yield return input;
        }
    }

    private static string BuildParagraphKey(string link)
    {
        string normalized = NormalizeParagraphLink(link);
        Match objectIdMatch = Regex.Match(normalized, "object-id=\\{(?<id>[^}]+)\\}", RegexOptions.IgnoreCase);
        if (objectIdMatch.Success)
        {
            return $"object-id:{objectIdMatch.Groups["id"].Value.ToLowerInvariant()}";
        }

        return $"link:{normalized.ToLowerInvariant()}";
    }

    private static string NormalizeParagraphLink(string link)
    {
        return WebUtility.HtmlDecode(link).Trim();
    }

    private static string NormalizeParagraphText(string text)
    {
        return WebUtility.HtmlDecode(text).Trim();
    }

    private static string TakeFirstLine(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return text;
        }

        int newlineIndex = text.IndexOfAny(new[] { '\r', '\n' });
        if (newlineIndex < 0)
        {
            return text;
        }

        return text[..newlineIndex].TrimEnd();
    }

    private static string? NormalizeDateToken(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            return null;
        }

        Match match = Regex.Match(input.Trim(), "^(?<date>\\d{8})");
        return match.Success ? match.Groups["date"].Value : null;
    }

    private void TryRestoreWindowPlacement()
    {
        try
        {
            if (!File.Exists(_windowStateFilePath))
            {
                return;
            }

            string json = File.ReadAllText(_windowStateFilePath);
            WindowPlacement? placement = JsonSerializer.Deserialize<WindowPlacement>(json);
            if (placement is null)
            {
                return;
            }

            var targetRect = new Rect(placement.Left, placement.Top, placement.Width, placement.Height);
            if (!IsRectVisibleOnAnyScreen(targetRect))
            {
                return;
            }

            Left = placement.Left;
            Top = placement.Top;
            Width = placement.Width;
            Height = placement.Height;
            WindowState = placement.WindowState;
        }
        catch
        {
            // Ignore placement restore issues and use default startup behavior.
        }
    }

    private void SaveWindowPlacement()
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_windowStateFilePath)!);

            Rect bounds = WindowState == WindowState.Normal
                ? new Rect(Left, Top, Width, Height)
                : RestoreBounds;

            var placement = new WindowPlacement(
                bounds.Left,
                bounds.Top,
                bounds.Width,
                bounds.Height,
                WindowState);

            string json = JsonSerializer.Serialize(placement, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_windowStateFilePath, json);
        }
        catch
        {
            // Ignore placement save issues.
        }
    }

    private static bool IsRectVisibleOnAnyScreen(Rect rect)
    {
        var virtualScreen = new Rect(
            SystemParameters.VirtualScreenLeft,
            SystemParameters.VirtualScreenTop,
            SystemParameters.VirtualScreenWidth,
            SystemParameters.VirtualScreenHeight);

        return virtualScreen.IntersectsWith(rect);
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
            int worksheetCount = (int)worksheets.Count;

            for (int wsIndex = 1; wsIndex <= worksheetCount; wsIndex++)
            {
                object? currentWorksheetObject = null;
                object? listObjectsObject = null;

                try
                {
                    currentWorksheetObject = worksheets.Item(wsIndex);
                    dynamic currentWorksheet = currentWorksheetObject;
                    listObjectsObject = currentWorksheet.ListObjects;
                    dynamic listObjects = listObjectsObject;
                    int listObjectCount = (int)listObjects.Count;

                    for (int tableIndex = 1; tableIndex <= listObjectCount; tableIndex++)
                    {
                        object? currentTableObject = null;
                        try
                        {
                            currentTableObject = listObjects.Item(tableIndex);
                            dynamic currentTable = currentTableObject;
                            string? currentName = currentTable.Name as string;

                            if (string.Equals(currentName, tableName, StringComparison.OrdinalIgnoreCase))
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

    private static int GetColumnIndex(dynamic tableColumns, string columnName)
    {
        dynamic tableColumn = tableColumns.Item(columnName);
        int index = (int)tableColumn.Index;
        ReleaseComObject(tableColumn);
        return index;
    }

    private static void SetHyperlinkCell(dynamic worksheet, dynamic targetRowRange, int columnIndex, OneNoteParagraphData paragraphData)
    {
        object? cellObject = null;
        object? hyperlinksObject = null;

        try
        {
            cellObject = targetRowRange.Cells[1, columnIndex];
            dynamic cell = cellObject;
            cell.Value2 = paragraphData.ParagraphText;
            cell.Hyperlinks.Delete();

            hyperlinksObject = worksheet.Hyperlinks;
            dynamic hyperlinks = hyperlinksObject;
            hyperlinks.Add(cell, paragraphData.ParagraphLink, Type.Missing, Type.Missing, paragraphData.ParagraphText);
        }
        finally
        {
            ReleaseComObject(hyperlinksObject);
            ReleaseComObject(cellObject);
        }
    }

    private static void CopyFormulaFromPreviousRow(dynamic tableColumns, dynamic previousRowRange, dynamic newRowRange, string columnName)
    {
        int columnIndex = GetColumnIndex(tableColumns, columnName);
        object? previousCellObject = null;
        object? newCellObject = null;

        try
        {
            previousCellObject = previousRowRange.Cells[1, columnIndex];
            newCellObject = newRowRange.Cells[1, columnIndex];
            dynamic previousCell = previousCellObject;
            dynamic newCell = newCellObject;

            // Do not propagate fixed values; only carry formulas forward.
            if (!(bool)previousCell.HasFormula)
            {
                return;
            }

            // R1C1 preserves relative intent and naturally shifts row references for the new row.
            newCell.FormulaR1C1 = previousCell.FormulaR1C1;
        }
        finally
        {
            ReleaseComObject(newCellObject);
            ReleaseComObject(previousCellObject);
        }
    }

    private static void SetCellRawValue(dynamic tableColumns, dynamic rowRange, string columnName, string value)
    {
        int columnIndex = GetColumnIndex(tableColumns, columnName);
        object? cellObject = null;

        try
        {
            cellObject = rowRange.Cells[1, columnIndex];
            dynamic cell = cellObject;
            cell.Value2 = value;
        }
        finally
        {
            ReleaseComObject(cellObject);
        }
    }

    private static void ReleaseComObject(object? comObject)
    {
        if (comObject is not null && Marshal.IsComObject(comObject))
        {
            Marshal.ReleaseComObject(comObject);
        }
    }

    private static bool TryGetActiveComObject(string progId, out object? comObject)
    {
        comObject = null;

        int clsidResult = CLSIDFromProgID(progId, out Guid clsid);
        if (clsidResult != 0)
        {
            return false;
        }

        int hr = GetActiveObject(ref clsid, IntPtr.Zero, out IntPtr unknown);
        if (hr != 0 || unknown == IntPtr.Zero)
        {
            return false;
        }

        try
        {
            comObject = Marshal.GetObjectForIUnknown(unknown);
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
    private static extern int GetActiveObject(ref Guid rclsid, IntPtr reserved, out IntPtr ppunk);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AddClipboardFormatListener(IntPtr hwnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool RemoveClipboardFormatListener(IntPtr hwnd);

    [DllImport("user32.dll")]
    private static extern uint GetClipboardSequenceNumber();

    private static void AppendValue(StringBuilder sb, object? value)
    {
        if (value is null)
        {
            sb.AppendLine("(null)");
            return;
        }

        sb.Append("Type: ").AppendLine(value.GetType().FullName ?? value.GetType().Name);

        switch (value)
        {
            case string text:
                sb.AppendLine("Content:");
                sb.AppendLine(text);
                return;
            case string[] parts:
                sb.AppendLine("Content:");
                for (int i = 0; i < parts.Length; i++)
                {
                    sb.Append('[').Append(i).Append("] ").AppendLine(parts[i]);
                }
                return;
            case byte[] bytes:
                AppendBytes(sb, bytes);
                return;
            case MemoryStream memoryStream:
                AppendBytes(sb, memoryStream.ToArray());
                return;
            case Stream stream:
                using (var copy = new MemoryStream())
                {
                    stream.CopyTo(copy);
                    AppendBytes(sb, copy.ToArray());
                }
                return;
            case BitmapSource bitmap:
                sb.Append("Bitmap: ").Append(bitmap.PixelWidth).Append(" x ").Append(bitmap.PixelHeight)
                  .Append(", dpi ").Append(bitmap.DpiX).Append(" x ").Append(bitmap.DpiY).AppendLine();
                return;
            case System.Collections.IDictionary dictionary:
                sb.AppendLine("Dictionary content:");
                foreach (object key in dictionary.Keys)
                {
                    if (key is null)
                    {
                        sb.AppendLine("- (null) = (null key is not indexable)");
                        continue;
                    }

                    sb.Append("- ").Append(key.ToString()).Append(" = ")
                        .AppendLine(dictionary[key]?.ToString() ?? "(null)");
                }
                return;
            case System.Collections.IEnumerable list:
                sb.AppendLine("Enumerable content:");
                int index = 0;
                foreach (object? item in list)
                {
                    sb.Append('[').Append(index++).Append("] ").AppendLine(item?.ToString() ?? "(null)");
                }
                return;
            default:
                sb.AppendLine("Content:");
                sb.AppendLine(value.ToString() ?? "(null)");
                return;
        }
    }

    private static void AppendBytes(StringBuilder sb, byte[] bytes)
    {
        sb.Append("Byte length: ").AppendLine(bytes.Length.ToString());
        sb.AppendLine("UTF-8 interpretation:");
        sb.AppendLine(Encoding.UTF8.GetString(bytes));
        sb.AppendLine();
        sb.AppendLine("Base64:");
        sb.AppendLine(Convert.ToBase64String(bytes));
    }
}