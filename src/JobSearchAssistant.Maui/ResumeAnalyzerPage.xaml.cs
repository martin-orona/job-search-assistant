using JobSearchAssistant.Maui.Components;
using JobSearchAssistant.Maui.Services;

namespace JobSearchAssistant.Maui;

public partial class ResumeAnalyzerPage : ContentPage
{
    private readonly AppStateService _stateService = new();
    private bool _isFirstAppearing = true;

    public string JobDescriptionContent
    {
        get => JobDescriptionEditor.Text ?? string.Empty;
        set => JobDescriptionEditor.Text = value;
    }

    public ResumeAnalyzerPage()
    {
        InitializeComponent();
    }

    public void SetJobDescriptionContent(string content)
    {
        JobDescriptionEditor.Text = content;
        SaveState();
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        if (_isFirstAppearing)
        {
            _isFirstAppearing = false;
            RestoreState();
            ApplyExpanderVisualState();
        }
    }

    private void OnExpanderToggleTapped(object? sender, EventArgs e)
    {
        Expander.ToggleExpander(sender, e);
        SaveState();
    }

    private void SaveState()
    {
        var state = _stateService.LoadState();
        state.ResumeAnalyzer.AiPromptExpanded = Expander.GetIsExpanded(AiPrompt_Container_Expander);
        state.ResumeAnalyzer.AiPromptContentExpanded = Expander.GetIsExpanded(AiPrompt_Content_Expander);
        state.ResumeAnalyzer.JobDescriptionExpanded = Expander.GetIsExpanded(JobDescription_Container_Expander);
        state.ResumeAnalyzer.DescriptionExpanded = Expander.GetIsExpanded(JobDescription_Content_Expander);
        state.ResumeAnalyzer.ResumeExpanded = Expander.GetIsExpanded(Resume_Container_Expander);
        state.ResumeAnalyzer.ResumeContentExpanded = Expander.GetIsExpanded(Resume_Content_Expander);
        state.ResumeAnalyzer.TemplateExpanded = Expander.GetIsExpanded(AiPromptTemplate_Container_Expander);
        state.ResumeAnalyzer.TemplateContentExpanded = Expander.GetIsExpanded(AiPromptTemplate_Content_Expander);
        state.ResumeAnalyzer.JobDescriptionFilePath = JobDescriptionFilePath.Text ?? string.Empty;
        state.ResumeAnalyzer.ResumeFilePath = ResumeFilePath.Text ?? string.Empty;
        state.ResumeAnalyzer.TemplateFilePath = TemplateFilePath.Text ?? string.Empty;
        state.ResumeAnalyzer.AiUrl = AiUrlEntry.Text ?? string.Empty;
        _stateService.SaveState(state);
    }

    private void RestoreState()
    {
        var state = _stateService.LoadState();
        Expander.SetIsExpanded(AiPrompt_Container_Expander, state.ResumeAnalyzer.AiPromptExpanded);
        Expander.SetIsExpanded(AiPrompt_Content_Expander, state.ResumeAnalyzer.AiPromptContentExpanded);
        Expander.SetIsExpanded(JobDescription_Container_Expander, state.ResumeAnalyzer.JobDescriptionExpanded);
        Expander.SetIsExpanded(JobDescription_Content_Expander, state.ResumeAnalyzer.DescriptionExpanded);
        Expander.SetIsExpanded(Resume_Container_Expander, state.ResumeAnalyzer.ResumeExpanded);
        Expander.SetIsExpanded(Resume_Content_Expander, state.ResumeAnalyzer.ResumeContentExpanded);
        Expander.SetIsExpanded(AiPromptTemplate_Container_Expander, state.ResumeAnalyzer.TemplateExpanded);
        Expander.SetIsExpanded(AiPromptTemplate_Content_Expander, state.ResumeAnalyzer.TemplateContentExpanded);
        AiUrlEntry.Text = state.ResumeAnalyzer.AiUrl;
        JobDescriptionFilePath.Text = state.ResumeAnalyzer.JobDescriptionFilePath;
        ResumeFilePath.Text = state.ResumeAnalyzer.ResumeFilePath;
        TemplateFilePath.Text = state.ResumeAnalyzer.TemplateFilePath;
        LoadFileContentIfExists(state.ResumeAnalyzer.JobDescriptionFilePath, JobDescriptionEditor);
        LoadFileContentIfExists(state.ResumeAnalyzer.ResumeFilePath, ResumeEditor);
        LoadFileContentIfExists(state.ResumeAnalyzer.TemplateFilePath, TemplateEditor);
    }

    private void ApplyExpanderVisualState()
    {
        Expander.ApplyExpandedState(AiPrompt_Container_Expander);
        Expander.ApplyExpandedState(AiPrompt_Content_Expander);
        Expander.ApplyExpandedState(JobDescription_Container_Expander);
        Expander.ApplyExpandedState(JobDescription_Content_Expander);
        Expander.ApplyExpandedState(Resume_Container_Expander);
        Expander.ApplyExpandedState(Resume_Content_Expander);
        Expander.ApplyExpandedState(AiPromptTemplate_Container_Expander);
        Expander.ApplyExpandedState(AiPromptTemplate_Content_Expander);
    }

    private void LoadFileContentIfExists(string filePath, Editor editor)
    {
        if (string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath)) { return; }
        try { editor.Text = File.ReadAllText(filePath); } catch { }
    }

    private async void OnFromClipboardClicked(object? sender, EventArgs e) => await SetEditorFromClipboardAsync(JobDescriptionEditor);
    private async void OnResumeFromClipboardClicked(object? sender, EventArgs e) => await SetEditorFromClipboardAsync(ResumeEditor);
    private async void OnTemplateFromClipboardClicked(object? sender, EventArgs e) => await SetEditorFromClipboardAsync(TemplateEditor);

    private async Task SetEditorFromClipboardAsync(Editor editor)
    {
        try
        {
            var text = await Clipboard.GetTextAsync();
            if (!string.IsNullOrEmpty(text)) { editor.Text = text; }
        }
        catch (Exception ex)
        {
            await DisplayAlertAsync("Error", $"Failed to get clipboard content: {ex.Message}", "OK");
        }
    }

    private async void OnFromFileClicked(object? sender, EventArgs e) => await LoadSelectedFileAsync(JobDescriptionFilePath, JobDescriptionEditor);
    private async void OnResumeFromFileClicked(object? sender, EventArgs e) => await LoadSelectedFileAsync(ResumeFilePath, ResumeEditor);
    private async void OnTemplateFromFileClicked(object? sender, EventArgs e) => await LoadSelectedFileAsync(TemplateFilePath, TemplateEditor);

    private async Task LoadSelectedFileAsync(Entry pathEntry, Editor editor)
    {
        if (string.IsNullOrEmpty(pathEntry.Text))
        {
            await DisplayAlertAsync("Error", "No file selected", "OK");
            return;
        }
        await LoadFileContentAsync(pathEntry.Text, editor);
    }

    private async void OnSelectJobDescriptionFileClicked(object? sender, EventArgs e) => await SelectFileAsync("Select Job Description File", JobDescriptionFilePath, JobDescriptionEditor);
    private async void OnResumeSelectFileClicked(object? sender, EventArgs e) => await SelectFileAsync("Select Resume File", ResumeFilePath, ResumeEditor);
    private async void OnTemplateSelectFileClicked(object? sender, EventArgs e) => await SelectFileAsync("Select Template File", TemplateFilePath, TemplateEditor);

    private async Task SelectFileAsync(string pickerTitle, Entry pathEntry, Editor editor)
    {
        try
        {
            var result = await FilePicker.Default.PickAsync(new PickOptions { PickerTitle = pickerTitle });
            if (result != null)
            {
                pathEntry.Text = result.FullPath;
                await LoadFileContentAsync(result.FullPath, editor);
                SaveState();
            }
        }
        catch (Exception ex)
        {
            await DisplayAlertAsync("Error", $"Failed to pick file: {ex.Message}", "OK");
        }
    }

    private async Task LoadFileContentAsync(string filePath, Editor editor)
    {
        try
        {
            if (File.Exists(filePath)) { editor.Text = await File.ReadAllTextAsync(filePath); }
        }
        catch (Exception ex)
        {
            await DisplayAlertAsync("Warning", $"Could not read file content: {ex.Message}", "OK");
        }
    }

    private async void OnOpenJobDescriptionFileClicked(object? sender, EventArgs e) => await OpenSelectedFileAsync("Open Job Description", JobDescriptionFilePath);
    private async void OnResumeOpenFileClicked(object? sender, EventArgs e) => await OpenSelectedFileAsync(null, ResumeFilePath);
    private async void OnTemplateOpenFileClicked(object? sender, EventArgs e) => await OpenSelectedFileAsync(null, TemplateFilePath);

    private async Task OpenSelectedFileAsync(string? title, Entry pathEntry)
    {
        try
        {
            var filePath = pathEntry.Text;
            if (string.IsNullOrEmpty(filePath))
            {
                await DisplayAlertAsync("Error", "No file selected", "OK");
                return;
            }
            if (!File.Exists(filePath))
            {
                await DisplayAlertAsync("Error", $"File not found: {filePath}", "OK");
                return;
            }
            await Launcher.Default.OpenAsync(new OpenFileRequest
            {
                Title = title,
                File = new ReadOnlyFile(filePath)
            });
        }
        catch (Exception ex)
        {
            await DisplayAlertAsync("Error", $"Failed to open file: {ex.Message}", "OK");
        }
    }

    public async void OnPromptAiClicked(object? sender, EventArgs e) => await GenerateAiPromptAndLaunchAiWebsite();

    public async Task<bool> GenerateAiPromptAndLaunchAiWebsite()
    {
        var result = await GenerateAiPrompt();
        result = result && await OnOpenAiClicked();
        return result;
    }

    private async void OnGeneratePromptClicked(object? sender, EventArgs e) => await GenerateAiPrompt();


    private async Task<bool> GenerateAiPrompt()
    {
        if (string.IsNullOrWhiteSpace(TemplateEditor.Text))
        {
            ShowStatus("Select an AI prompt template first", Colors.Orange);
            return false;
        }

        if (string.IsNullOrWhiteSpace(ResumeEditor.Text))
        {
            ShowStatus("Select a resume first", Colors.Orange);
            return false;
        }

        if (string.IsNullOrWhiteSpace(JobDescriptionEditor.Text))
        {
            ShowStatus("Select a job description first", Colors.Orange);
            return false;
        }

        try
        {
            string generatedPrompt = (TemplateEditor.Text ?? string.Empty)
                .Replace("[YOUR RESUME HERE]", ResumeEditor.Text ?? string.Empty, StringComparison.Ordinal)
                .Replace("[JOB DESCRIPTION HERE]", JobDescriptionEditor.Text ?? string.Empty, StringComparison.Ordinal);
            AiPromptEditor.Text = generatedPrompt;
            await Clipboard.SetTextAsync(generatedPrompt);
            ShowStatus("Prompt generated and copied to clipboard", Colors.Green);
        }
        catch (Exception ex)
        {
            ShowStatus($"Failed to generate prompt: {ex.Message}", Colors.Red);
            return false;
        }

        return true;
    }

    private async void OnCopyPromptClicked(object? sender, EventArgs e)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(AiPromptEditor.Text)) { ShowStatus("No prompt to copy", Colors.Orange); return; }
            await Clipboard.SetTextAsync(AiPromptEditor.Text);
            ShowStatus("Prompt copied to clipboard", Colors.Green);
        }
        catch (Exception ex) { ShowStatus($"Failed to copy: {ex.Message}", Colors.Red); }
    }

    private async void OnOpenAiClicked(object? sender, EventArgs e) => await OnOpenAiClicked();

    private async Task<bool> OnOpenAiClicked()
    {
        try
        {
            string url = AiUrlEntry.Text?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(url))
            {
                await DisplayAlertAsync("Error", "Enter an AI URL first", "OK");
                return false;
            }

            if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                url = "https://" + url;
            }

            await Launcher.Default.OpenAsync(new Uri(url));
            return true;
        }
        catch (Exception ex)
        {
            await DisplayAlertAsync("Error", $"Failed to open URL: {ex.Message}", "OK");
            return false;
        }
    }

    private void OnAiUrlEntryUnfocused(object? sender, FocusEventArgs e) => SaveState();

    public void ShowStatus(string message, Color? textColor = null)
    {
        StatusLabel.Text = message;
        StatusLabel.TextColor = textColor ?? Colors.Gray;
    }
}
