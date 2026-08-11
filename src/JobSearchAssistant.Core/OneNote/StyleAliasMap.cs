namespace JobSearchAssistant.Core.OneNote;

/// <summary>
/// Maps canonical style names and common aliases to normalised names.
/// Also maps OneNote QuickStyle XML names (h1, h2, p) to canonical names.
/// </summary>
internal static class StyleAliasMap
{
    private static readonly Dictionary<string, string> _aliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["h1"] = "Heading 1",
        ["h2"] = "Heading 2",
        ["h3"] = "Heading 3",
        ["h4"] = "Heading 4",
        ["h5"] = "Heading 5",
        ["h6"] = "Heading 6",
        ["p"]  = "Normal",
        ["heading1"] = "Heading 1",
        ["heading2"] = "Heading 2",
        ["heading3"] = "Heading 3",
        ["heading4"] = "Heading 4",
        ["heading5"] = "Heading 5",
        ["heading6"] = "Heading 6",
        ["normal"]   = "Normal",
    };

    /// <summary>Returns the canonical style name, or the input unchanged if already canonical.</summary>
    public static string Normalise(string raw)
        => _aliases.TryGetValue(raw.Trim(), out var canonical) ? canonical : raw.Trim();

    /// <summary>
    /// Returns the heading level (1-6) for a canonical or alias style name,
    /// or 0 if the style is not a heading.
    /// </summary>
    public static int HeadingLevel(string styleName)
    {
        var canonical = Normalise(styleName);
        return canonical switch
        {
            "Heading 1" => 1,
            "Heading 2" => 2,
            "Heading 3" => 3,
            "Heading 4" => 4,
            "Heading 5" => 5,
            "Heading 6" => 6,
            _ => 0
        };
    }
}
