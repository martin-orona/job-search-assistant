using JobSearchAssistant.Maui.Components;
using JobSearchAssistant.Maui.Services;

using System.Text.RegularExpressions;

using WindowsClipboard = Windows.ApplicationModel.DataTransfer.Clipboard;
using WindowsDataPackage = Windows.ApplicationModel.DataTransfer.DataPackage;
using WinTextBox = Microsoft.UI.Xaml.Controls.TextBox;
using WinWebView2 = Microsoft.UI.Xaml.Controls.WebView2;

namespace JobSearchAssistant.Maui;

public partial class JobListingsPage : ContentPage
{
    private readonly AppStateService _stateService = new();
    private bool _isPageReady;
    private bool _isFirstAppearing = true;
    private string _formattedListingHtml = string.Empty;
    private string _listingTitle = string.Empty;
    private string _listingCompany = string.Empty;
    private string _listingLocation = string.Empty;
    private WinTextBox? _urlEntryTextBox;
    private bool _isUrlPastePending;

    public bool IsPageReady => _isPageReady;

    public JobListingsPage()
    {
        InitializeComponent();
        UrlEntry.HandlerChanged += OnUrlEntryHandlerChanged;
        UrlEntry.TextChanged += OnUrlEntryTextChanged;
        JobListingWebView.Navigated += OnWebViewNavigated;
        JobListingWebView.Source = "https://www.indeed.com";
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        if (!_isFirstAppearing)
        {
            return;
        }

        _isFirstAppearing = false;
        RestoreState();
        ApplyExpanderVisualState();
    }

    private void OnExpanderToggleTapped(object? sender, EventArgs e)
    {
        Expander.ToggleExpander(sender, e);
        SaveState();
    }

    private void OnWebViewNavigated(object? sender, WebNavigatedEventArgs e)
    {
        _isPageReady = e.Result == WebNavigationResult.Success;
        GoButton.IsEnabled = true;
        ExtractButton.IsEnabled = _isPageReady;
        ExtractWorkflowButton.IsEnabled = _isPageReady;
        ShowStatus(_isPageReady ? "Page ready. Select Extract." : "The page could not be loaded.", !_isPageReady);
    }

    private void OnUrlCompleted(object? sender, EventArgs e)
    {
        GoButton.Focus();
        OnGoClicked(GoButton, e);
    }

    private void OnUrlEntryHandlerChanged(object? sender, EventArgs e)
    {
        if (_urlEntryTextBox is not null)
        {
            _urlEntryTextBox.Paste -= OnUrlEntryPasted;
        }

        _urlEntryTextBox = UrlEntry.Handler?.PlatformView as WinTextBox;
        if (_urlEntryTextBox is not null)
        {
            _urlEntryTextBox.Paste += OnUrlEntryPasted;
        }
    }

    private void OnUrlEntryPasted(object sender, Microsoft.UI.Xaml.Controls.TextControlPasteEventArgs e)
    {
        _isUrlPastePending = true;
    }

    private void OnUrlEntryTextChanged(object? sender, TextChangedEventArgs e)
    {
        if (!_isUrlPastePending)
        {
            return;
        }

        _isUrlPastePending = false;
        OnGoClicked(UrlEntry, EventArgs.Empty);
    }

    private void OnGoClicked(object? sender, EventArgs e)
    {
        string url = UrlEntry.Text?.Trim() ?? string.Empty;
        if (!Uri.TryCreate(url, UriKind.Absolute, out Uri? uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            ShowStatus("Enter a valid http or https URL.", true);
            return;
        }

        _isPageReady = false;
        GoButton.IsEnabled = false;
        ExtractButton.IsEnabled = false;
        ExtractWorkflowButton.IsEnabled = false;
        JobListingWebView.Source = uri;
        SaveState();
        ShowStatus("Page loading...");
    }

    private async void OnExtractClicked(object? sender, EventArgs e)
    {
        await ExtractJobListing();
    }

    private async void OnExtractWorkflowClicked(object? sender, EventArgs e)
    {

        // await ExtractJobListingWorkflow();
        await JobWorkflow.BeginAtJobListing(this);
    }

    private async Task<bool> ExtractJobListing()
    {
        return false;
        //return await ExtractJobListing_Indeed(); 
    }


    public async Task<string?> ExecuteWebScript(string script)
    {
        return await ExecuteListingScriptAsync(script);
    }

    private async Task<string?> ExecuteListingScriptAsync(string script)
    {
        if (JobListingWebView.Handler?.PlatformView is not WinWebView2 webView)
        {
            return null;
        }

        await webView.EnsureCoreWebView2Async();
        return await webView.CoreWebView2.ExecuteScriptAsync(script);
    }


    private async void OnOpenExtractedFileClicked(object? sender, EventArgs e)
    {
        string filePath = ExtractedFilePath.Text?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
        {
            ShowStatus("No extracted job listing file is available.", true);
            return;
        }

        try
        {
            await Launcher.Default.OpenAsync(new OpenFileRequest
            {
                Title = "Open Extracted Job Listing",
                File = new ReadOnlyFile(filePath)
            });
        }
        catch (Exception ex)
        {
            ShowStatus($"Could not open extracted job listing: {ex.Message}", true);
        }
    }

    private async void OnCopyMarkdownClicked(object? sender, EventArgs e)
    {
        string content = ExtractedContentEditor.Text ?? string.Empty;
        if (string.IsNullOrWhiteSpace(content))
        {
            ShowStatus("There is no extracted content to copy.", true);
            return;
        }

        try
        {
            await Clipboard.Default.SetTextAsync(content);
            ShowStatus("Markdown job listing copied to the clipboard.");
        }
        catch (Exception ex)
        {
            ShowStatus($"Could not copy Markdown job listing: {ex.Message}", true);
        }
    }

    private async void OnCopyExtractedContentClicked(object? sender, EventArgs e)
    {
        string markdown = ExtractedContentEditor.Text ?? string.Empty;
        if (string.IsNullOrWhiteSpace(markdown))
        {
            ShowStatus("There is no extracted content to copy.", true);
            return;
        }

        try
        {
            var package = new WindowsDataPackage();
            package.SetText(MarkdownToPlainText(markdown));
            package.SetHtmlFormat(string.IsNullOrWhiteSpace(_formattedListingHtml)
                ? MarkdownToHtml(markdown)
                : _formattedListingHtml);
            WindowsClipboard.SetContent(package);
            ShowStatus("Formatted job listing copied to the clipboard.");
        }
        catch (Exception ex)
        {
            ShowStatus($"Could not copy formatted job listing: {ex.Message}", true);
        }
    }

    public async Task JobListingWasExtracted(JobListingData listing, string filePath)
    {
        _formattedListingHtml = listing.FormattedHtml;
        _listingTitle = listing.Title;
        _listingCompany = listing.Company;
        _listingLocation = listing.Location;
        ExtractedFilePath.Text = filePath;
        ExtractedContentEditor.Text = await File.ReadAllTextAsync(filePath);
        SetFormattedContent(_formattedListingHtml);
        SaveState();
    }

    public string ExtractedContent
    {
        get => ExtractedContentEditor.Text ?? string.Empty;
    }

    private static string MarkdownToPlainText(string markdown)
    {
        string plainText = Regex.Replace(markdown, "^#{1,6}\\s*", string.Empty, RegexOptions.Multiline);
        plainText = Regex.Replace(plainText, "\\*\\*(.*?)\\*\\*", "$1");
        return plainText.Trim();
    }

    private static string MarkdownToHtml(string markdown)
    {
        string encoded = System.Net.WebUtility.HtmlEncode(markdown.Trim());
        encoded = Regex.Replace(encoded, "^######\\s+(.+)$", "<h6>$1</h6>", RegexOptions.Multiline);
        encoded = Regex.Replace(encoded, "^#####\\s+(.+)$", "<h5>$1</h5>", RegexOptions.Multiline);
        encoded = Regex.Replace(encoded, "^####\\s+(.+)$", "<h4>$1</h4>", RegexOptions.Multiline);
        encoded = Regex.Replace(encoded, "^###\\s+(.+)$", "<h3>$1</h3>", RegexOptions.Multiline);
        encoded = Regex.Replace(encoded, "^##\\s+(.+)$", "<h2>$1</h2>", RegexOptions.Multiline);
        encoded = Regex.Replace(encoded, "^#\\s+(.+)$", "<h1>$1</h1>", RegexOptions.Multiline);
        encoded = Regex.Replace(encoded, "\\*\\*(.+?)\\*\\*", "<strong>$1</strong>");
        encoded = Regex.Replace(encoded, "(?:\\r?\\n){2,}", "</p><p>");
        encoded = encoded.Replace("\r\n", "\n").Replace("\n", "<br>");
        return $"<html><body><p>{encoded}</p></body></html>";
    }

    private void RestoreState()
    {
        var state = _stateService.LoadState().JobListings;
        UrlEntry.Text = state.Url;
        Expander.SetIsExpanded(ListingPageExpander, state.ListingPageExpanded);
        Expander.SetIsExpanded(ExtractedJobListingExpander, state.ExtractedJobListingExpanded);
        Expander.SetIsExpanded(ExtractedContentExpander, state.ExtractedContentExpanded);
        Expander.SetIsExpanded(FormattedContentExpander, state.FormattedContentExpanded);
        ExtractedFilePath.Text = state.ExtractedFilePath;
        _formattedListingHtml = state.FormattedListingHtml;
        _listingTitle = state.Title;
        _listingCompany = state.Company;
        _listingLocation = state.Location;
        string markdown = LoadExtractedContent(state.ExtractedFilePath);
        if (string.IsNullOrWhiteSpace(_listingTitle) && !string.IsNullOrWhiteSpace(markdown))
        {
            (_listingTitle, _listingCompany, _listingLocation) = ReadListingMetadata(markdown);
        }

        _formattedListingHtml = EnsureFormattedHeader(_formattedListingHtml);
        SetFormattedContent(_formattedListingHtml);

        if (Uri.TryCreate(state.Url, UriKind.Absolute, out Uri? uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        {
            JobListingWebView.Source = uri;
        }
    }

    public void SetFormattedContent(string html)
    {
        FormattedContentViewer.Source = string.IsNullOrWhiteSpace(html)
            ? null
            : new HtmlWebViewSource
            {
                Html = $"<html><head><meta name=\"color-scheme\" content=\"light\"></head><body style=\"font-family: Segoe UI; margin: 12px; background-color: #ffffff; color: #1f1f1f;\">{html}</body></html>"
            };
    }

    private void ApplyExpanderVisualState()
    {
        Expander.ApplyExpandedState(ListingPageExpander);
        Expander.ApplyExpandedState(ExtractedJobListingExpander);
        Expander.ApplyExpandedState(ExtractedContentExpander);
        Expander.ApplyExpandedState(FormattedContentExpander);
    }

    private void SaveState()
    {
        var state = _stateService.LoadState();
        state.JobListings.ListingPageExpanded = Expander.GetIsExpanded(ListingPageExpander);
        state.JobListings.ExtractedJobListingExpanded = Expander.GetIsExpanded(ExtractedJobListingExpander);
        state.JobListings.ExtractedContentExpanded = Expander.GetIsExpanded(ExtractedContentExpander);
        state.JobListings.FormattedContentExpanded = Expander.GetIsExpanded(FormattedContentExpander);
        state.JobListings.ExtractedFilePath = ExtractedFilePath.Text ?? string.Empty;
        state.JobListings.FormattedListingHtml = _formattedListingHtml;
        state.JobListings.Title = _listingTitle;
        state.JobListings.Company = _listingCompany;
        state.JobListings.Location = _listingLocation;
        state.JobListings.Url = UrlEntry.Text?.Trim() ?? string.Empty;
        _stateService.SaveState(state);
    }

    private string LoadExtractedContent(string filePath)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
        {
            ExtractedContentEditor.Text = string.Empty;
            return string.Empty;
        }

        try
        {
            string markdown = File.ReadAllText(filePath);
            ExtractedContentEditor.Text = markdown;
            return markdown;
        }
        catch (Exception ex)
        {
            ShowStatus($"Could not read extracted job listing: {ex.Message}", true);
            return string.Empty;
        }
    }

    private string EnsureFormattedHeader(string html)
    {
        if (string.IsNullOrWhiteSpace(_listingTitle) || html.Contains("job-search-assistant-header", StringComparison.Ordinal))
        {
            return html;
        }

        string header = $"<div class=\"job-search-assistant-header\" style=\"margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #cccccc;\"><h1 style=\"margin: 0 0 8px 0;\">{System.Net.WebUtility.HtmlEncode(_listingTitle)}</h1><div style=\"margin-bottom: 4px;\"><strong>Company:</strong> {System.Net.WebUtility.HtmlEncode(_listingCompany)}</div><div><strong>Location:</strong> {System.Net.WebUtility.HtmlEncode(_listingLocation)}</div></div>";
        return header + html;
    }

    private static (string Title, string Company, string Location) ReadListingMetadata(string markdown)
    {
        string title = Regex.Match(markdown, "^#\\s+(?<value>.+)$", RegexOptions.Multiline).Groups["value"].Value.Trim();
        string company = Regex.Match(markdown, @"^\*\*Company:\*\*\s*(?<value>.*)$", RegexOptions.Multiline).Groups["value"].Value.Trim();
        string location = Regex.Match(markdown, @"^\*\*Location:\*\*\s*(?<value>.*)$", RegexOptions.Multiline).Groups["value"].Value.Trim();
        return (title, company, location);
    }


    public void ShowStatus(string message, bool isError = false)
    {
        StatusLabel.Text = message;
        StatusLabel.TextColor = isError ? Colors.Firebrick : Colors.Gray;
    }

}