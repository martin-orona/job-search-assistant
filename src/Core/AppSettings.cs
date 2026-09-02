namespace JobSearchAssistant.Core;

public class AppSettings
{
    public AppSettingsStorage? Storage { get; set; }

    public class AppSettingsStorage
    {
        public string? CloudFolder { get; set; }

        public string? LocalFolder { get; set; }
    }
}
