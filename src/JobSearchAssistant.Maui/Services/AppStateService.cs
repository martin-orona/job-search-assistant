using System.Text.Json;

namespace JobSearchAssistant.Maui.Services;

public class AppStateService
{
    private readonly string _stateFilePath;
    private readonly JsonSerializerOptions _jsonOptions;

    public AppStateService()
    {
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var appFolder = Path.Combine(appDataPath, "JobSearchAssistant");

        if (!Directory.Exists(appFolder))
        {
            Directory.CreateDirectory(appFolder);
        }

        _stateFilePath = Path.Combine(appFolder, "appstate.json");
        _jsonOptions = new JsonSerializerOptions { WriteIndented = true };
    }

    public AppState LoadState()
    {
        try
        {
            if (File.Exists(_stateFilePath))
            {
                var json = File.ReadAllText(_stateFilePath);
                var state = JsonSerializer.Deserialize<AppState>(json, _jsonOptions);
                return state ?? GetDefaultState();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading app state: {ex.Message}");
        }

        return GetDefaultState();
    }

    public void SaveState(AppState state)
    {
        try
        {
            var json = JsonSerializer.Serialize(state, _jsonOptions);
            File.WriteAllText(_stateFilePath, json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error saving app state: {ex.Message}");
        }
    }

    private static AppState GetDefaultState()
    {
        return new AppState
        {
            Window = new WindowState
            {
                X = 100,
                Y = 100,
                Width = 800,
                Height = 600
            },
            Navigation = new NavigationState
            {
                SelectedTabIndex = 0
            }
        };
    }
}
