using System.Text.Json.Serialization;

namespace JobSearchAssistant.Maui.Services;

public class AppState
{
    [JsonPropertyName("window")]
    public WindowState Window { get; set; } = new WindowState();

 
    [JsonPropertyName("navigation")]
    public NavigationState Navigation { get; set; } = new NavigationState();

    [JsonPropertyName("resumeAnalyzer")]
    public ResumeAnalyzerState ResumeAnalyzer { get; set; } = new ResumeAnalyzerState();

}

public class NavigationState
{
    [JsonPropertyName("selectedTabIndex")]
    public int SelectedTabIndex { get; set; } = 0;

 }

public class ResumeAnalyzerState 
{
    [JsonPropertyName("aiPromptExpanded")]
    public bool AiPromptExpanded { get; set; } = true;
    [JsonPropertyName("aiPromptContentExpanded")]
    public bool AiPromptContentExpanded { get; set; } = true;
    [JsonPropertyName("jobDescriptionExpanded")]
    public bool JobDescriptionExpanded { get; set; } = true;
    [JsonPropertyName("descriptionExpanded")]
    public bool DescriptionExpanded { get; set; } = true;
    [JsonPropertyName("resumeExpanded")]
    public bool ResumeExpanded { get; set; } = true;
    [JsonPropertyName("resumeContentExpanded")]
    public bool ResumeContentExpanded { get; set; } = true;
    [JsonPropertyName("templateExpanded")]
    public bool TemplateExpanded { get; set; } = true;
    [JsonPropertyName("templateContentExpanded")]
    public bool TemplateContentExpanded { get; set; } = true;

    [JsonPropertyName("jobDescriptionFilePath")]
    public string JobDescriptionFilePath { get; set; } = string.Empty;
    [JsonPropertyName("resumeFilePath")]
    public string ResumeFilePath { get; set; } = string.Empty;
    [JsonPropertyName("templateFilePath")]
    public string TemplateFilePath { get; set; } = string.Empty;
    [JsonPropertyName("aiUrl")]
    public string AiUrl { get; set; } = string.Empty;
}




public class WindowState
{
    [JsonPropertyName("x")]
    public double X { get; set; }
    [JsonPropertyName("y")]
    public double Y { get; set; }
    [JsonPropertyName("width")]
    public double Width { get; set; }
    [JsonPropertyName("height")]
    public double Height { get; set; }
}