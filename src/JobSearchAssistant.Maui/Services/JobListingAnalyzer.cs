namespace JobSearchAssistant.Maui.Services;

public  sealed record JobListingData(string Company, string Title, string Location, string Description, string FormattedHtml = "");

