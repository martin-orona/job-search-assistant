using System.Text.Json;
using System.Text.RegularExpressions;

namespace JobSearchAssistant.Maui.Services;

public static class JobWorkflow
{
    static readonly Dictionary<Type, List<IWorkflow>> Workflows = new();

    public static async Task BeginAtJobListing(JobListingsPage page)
    {
        var workflow = CreateWorkflow<JobListingAssessmentWorkflow>();
        await workflow.BeginAtJobListing(page);
        // await ExtractJobListingWorkflow();

    }

    private static T CreateWorkflow<T>() where T : IWorkflow, new()
    {
        List<IWorkflow> workflows;
        if (!Workflows.ContainsKey(typeof(T)))
        { Workflows[typeof(T)] = new List<IWorkflow>(); }

        workflows = Workflows[typeof(T)];

        var workflow = new T();
        workflows.Add(workflow);

        return workflow;
    }


}

internal interface IWorkflow { }
internal class JobListingAssessmentWorkflow : IWorkflow
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex RepeatedWhitespace = new("\\s+", RegexOptions.Compiled);
    private static readonly Regex UnsafeFileNameCharacters = new("[^A-Za-z0-9 ._-]", RegexOptions.Compiled);


    public Task BeginAtJobListing(JobListingsPage page)
    {
        return ExtractJobListingWorkflow(page);
    }

    private async Task ExtractJobListingWorkflow(JobListingsPage page)
    {
        var extraction = await ExtractJobListing(page);
        if (!extraction.success)
        { return; }

        if (!CopyJobListingToResumeAnalyzer(page))
        { return; }

        var resumeAnalyzerPage = Utilities.Navigation.FocusPage<ResumeAnalyzerPage>();
        if (resumeAnalyzerPage is null)
        {
            page.ShowStatus("The Resume Analyzer page is unavailable.", true);
            return;
        }

        var launched = await resumeAnalyzerPage.GenerateAiPromptAndLaunchAiWebsite();
        if (!launched)
        {
            Utilities.Navigation.FocusPage<JobListingsPage>();
            page.ShowStatus("Failed to launch AI website.", true);
            return;
        }
    }

    private bool CopyJobListingToResumeAnalyzer(JobListingsPage page)
    {
        string content = page.ExtractedContent;
        if (string.IsNullOrWhiteSpace(content))
        {
            page.ShowStatus("There is no extracted content to copy.", true);
            return false;
        }

        ResumeAnalyzerPage? resumeAnalyzerPage = Utilities.Navigation.GetPage<ResumeAnalyzerPage>();
        if (resumeAnalyzerPage is null)
        {
            page.ShowStatus("The Resume Analyzer page is unavailable.", true);
            return false;
        }

        resumeAnalyzerPage.JobDescriptionContent = content;
        page.ShowStatus("Extracted content copied to the Resume Analyzer.");
        resumeAnalyzerPage.ShowStatus("Extracted content received from the Job Listings page.");
        return true;
    }


    private async Task<(bool success, JobListingData? listing, string? filePath)> ExtractJobListing(JobListingsPage page)
    {
        var result = await ExtractJobListing_Indeed(page);
        string? filePath = null;
        if (result.success && result.listing is not null)
        {
            filePath = await StoreListing(result.listing);
            await page.JobListingWasExtracted(result.listing, filePath);
            page.ShowStatus($"Job listing saved to {filePath}");
        }
        return (result.success, result.listing, filePath);
    }

    private async Task<(bool success, JobListingData? listing)> ExtractJobListing_Indeed(JobListingsPage page)
    {
        if (page is null || !page.IsPageReady)
        {
            page?.ShowStatus("Wait for the job listing page to finish loading.", true);
            return (false, null);
        }

        try
        {
            page.ShowStatus("Extracting job listing...");
            string? json = await ExecuteListingScript(page);
            if (string.IsNullOrWhiteSpace(json))
            {
                page.ShowStatus("The browser returned no script result. Reload the page and try again.", true);
                return (false, null);
            }

            JobListingData? listing = JsonSerializer.Deserialize<JobListingData>(json, JsonOptions);
            if (listing is null || string.IsNullOrWhiteSpace(listing.Description))
            {
                page.ShowStatus("No Indeed job listing was found on the current page.", true);
                return (false, null);
            }

            return (true, listing);
        }
        catch (Exception ex)
        {
            page.ShowStatus($"Extraction failed: {ex.Message}", true);
            return (false, null);
        }
    }

    private async Task<string?> ExecuteListingScript(JobListingsPage page)
    {
        var script = """
                (() => {
                    const listing = document.querySelector('.jobsearch-JobComponent');
                    const header = listing?.querySelector('.jobsearch-InfoHeaderContainer');
                    const text = selector => listing?.querySelector(selector)?.innerText?.trim() || '';
                    const company = header?.querySelector('[data-company-name="true"][data-testid="inlineHeader-companyName"]')?.innerText?.trim() || '';
                    const title = text('[data-testid="jobsearch-JobInfoHeader-title"], h1');
                    const location = header?.querySelector('[data-testid="inlineHeader-companyLocation"]')?.innerText?.trim() || '';
                    const content = listing?.querySelector('.jobsearch-JobComponent-description')
                        || listing?.querySelector('.jobsearch-BodyContainer');
                    const styleProperties = ['font-family', 'font-size', 'font-weight', 'font-style', 'color', 'background-color', 'text-align', 'line-height', 'margin', 'padding', 'display', 'white-space'];
                    const formattedRoot = document.createElement('div');
                    const escapeHtml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
                    formattedRoot.innerHTML = `<div class="job-search-assistant-header" style="margin-bottom: 20px; padding-bottom: 12px; border-bottom: 1px solid #cccccc;">
                        <h1 style="margin: 0 0 8px 0;">${escapeHtml(title)}</h1>
                        <div style="margin-bottom: 4px;"><strong>Company:</strong> ${escapeHtml(company)}</div>
                        <div><strong>Location:</strong> ${escapeHtml(location)}</div>
                    </div>`;
                    [content].filter(Boolean).forEach(source => {
                        const clone = source.cloneNode(true);
                        const sourceElements = [source, ...source.querySelectorAll('*')];
                        const cloneElements = [clone, ...clone.querySelectorAll('*')];
                        sourceElements.forEach((sourceElement, index) => {
                            const target = cloneElements[index];
                            if (!target) return;
                            const styles = getComputedStyle(sourceElement);
                            styleProperties.forEach(property => target.style.setProperty(property, styles.getPropertyValue(property)));
                        });
                        formattedRoot.appendChild(clone);
                    });
                    return {
                        company,
                        title,
                        location,
                        description: text('.jobsearch-JobComponent-description') || text('.jobsearch-BodyContainer'),
                        formattedHtml: formattedRoot.innerHTML
                    };
                })()
                """;
        return await page.ExecuteWebScript(script);
    }

    private static async Task<string> StoreListing(JobListingData listing)
    {
        string company = NormalizeFilePart(listing.Company, "Unknown Company");
        string title = NormalizeFilePart(listing.Title, "Unknown Job");
        string workMode = listing.Location.Contains("remote", StringComparison.OrdinalIgnoreCase) ? "remote" : "local";
        string date = DateTime.Now.ToString("yyyyMMdd");
        string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "JobSearchAssistant", "JobListings");
        Directory.CreateDirectory(folder);

        string filePath = Path.Combine(folder, $"{company} - {title} - {date} - {workMode}.md");
        string markdown = $"# {listing.Title}\n\n**Company:** {listing.Company}\n\n**Location:** {listing.Location}\n\n{listing.Description.Trim()}\n";
        await File.WriteAllTextAsync(filePath, markdown);
        return filePath;
    }

    private static string NormalizeFilePart(string? value, string fallback)
    {
        string normalized = RepeatedWhitespace.Replace(value?.Trim() ?? string.Empty, " ");
        normalized = UnsafeFileNameCharacters.Replace(normalized, "_").Trim(' ', '.');
        return string.IsNullOrWhiteSpace(normalized) ? fallback : normalized;
    }
}