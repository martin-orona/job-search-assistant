namespace JobSearchAssistant.Core;

using System.Text.Json;

public class Configuration
{
    public static AppSettings LoadAppSettings(string path)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"The file '{path}' does not exist.");
        }

        string fileContent;
        try
        {
            fileContent = File.ReadAllText(path);
        }
        catch (Exception ex)
        {
            throw new IOException($"Failed to read the file '{path}'.", ex);
        }

        AppSettings? result;
        try
        {
            result = JsonSerializer.Deserialize<AppSettings>(fileContent);
        }
        catch (Exception ex)
        {
            throw new IOException($"Failed to deserialize the file '{path}'.", ex);
        }

        if (result == null)
        {
            throw new InvalidOperationException($"The file '{path}' could not be deserialized into an AppSettings object.");
        }

        return result;
    }
}
