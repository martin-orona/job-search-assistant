using System.Xml.Linq;

namespace JobSearchAssistant.Core.OneNote;

/// <summary>
/// Resolves a ">"-delimited path string to a OneNote page ID by walking hierarchy XML.
/// </summary>
internal static class PathResolver
{
    /// <summary>
    /// Parses a path like "Notebook > Section Group > Section > Page"
    /// and returns the matching <see cref="ResolvedPage"/>.
    /// </summary>
    public static ResolvedPage Resolve(string path, string hierarchyXml)
    {
        var tokens = TokenisePath(path);
        if (tokens.Count < 2)
            throw new SyncException(SyncErrorCode.PathNotFound,
                $"Path must contain at least a notebook and a page name: '{path}'");

        var doc = XDocument.Parse(hierarchyXml);
        var ns = doc.Root!.GetDefaultNamespace();

        // Walk tokens: first token = notebook, last token = page, middle tokens = groups/sections
        var candidates = FindCandidates(doc.Root!, ns, tokens, 0);

        return candidates.Count switch
        {
            0 => throw new SyncException(SyncErrorCode.PathNotFound,
                    $"No OneNote page matched path: '{path}'"),
            1 => candidates[0],
            _ => throw new SyncException(SyncErrorCode.PathAmbiguous,
                    $"Path '{path}' matched {candidates.Count} pages: " +
                    string.Join(", ", candidates.Select(c => c.FullPath)),
                    detail: string.Join("\n", candidates.Select(c => c.FullPath)))
        };
    }

    /// <summary>Splits on unescaped ">" and trims each token.</summary>
    internal static IReadOnlyList<string> TokenisePath(string path)
    {
        var tokens = new List<string>();
        var current = new System.Text.StringBuilder();
        for (int i = 0; i < path.Length; i++)
        {
            if (path[i] == '\\' && i + 1 < path.Length && path[i + 1] == '>')
            {
                current.Append('>');
                i++;
            }
            else if (path[i] == '>')
            {
                var token = current.ToString().Trim();
                if (token.Length > 0) tokens.Add(token);
                current.Clear();
            }
            else
            {
                current.Append(path[i]);
            }
        }
        var last = current.ToString().Trim();
        if (last.Length > 0) tokens.Add(last);
        return tokens;
    }

    private static List<ResolvedPage> FindCandidates(
        XElement root, XNamespace ns, IReadOnlyList<string> tokens, int depth)
    {
        var results = new List<ResolvedPage>();
        var token = tokens[depth];
        bool isLastToken = depth == tokens.Count - 1;

        foreach (var child in root.Elements())
        {
            var localName = child.Name.LocalName;
            var name = (string?)child.Attribute("name") ?? "";

            if (!NameMatches(name, token)) continue;

            if (isLastToken && localName == "Page")
            {
                var id = (string?)child.Attribute("ID") ?? "";
                results.Add(new ResolvedPage(id, name, BuildFullPath(child)));
            }
            else if (!isLastToken && localName is "Notebook" or "SectionGroup" or "Section")
            {
                results.AddRange(FindCandidates(child, ns, tokens, depth + 1));
            }
        }

        // If no exact matches at this level, try case-insensitive across all children
        if (results.Count == 0)
        {
            foreach (var child in root.Elements())
            {
                var localName = child.Name.LocalName;
                var name = (string?)child.Attribute("name") ?? "";

                if (!NameMatchesCaseInsensitive(name, token)) continue;

                if (isLastToken && localName == "Page")
                {
                    var id = (string?)child.Attribute("ID") ?? "";
                    results.Add(new ResolvedPage(id, name, BuildFullPath(child)));
                }
                else if (!isLastToken && localName is "Notebook" or "SectionGroup" or "Section")
                {
                    results.AddRange(FindCandidates(child, ns, tokens, depth + 1));
                }
            }
        }

        return results;
    }

    private static string BuildFullPath(XElement element)
    {
        var parts = new List<string>();
        var current = element;
        while (current != null && current.Name.LocalName != "Notebooks")
        {
            var name = (string?)current.Attribute("name");
            if (name != null) parts.Insert(0, name);
            current = current.Parent;
        }
        return string.Join(" > ", parts);
    }

    private static bool NameMatches(string name, string token)
        => string.Equals(name, token, StringComparison.Ordinal);

    private static bool NameMatchesCaseInsensitive(string name, string token)
        => string.Equals(name, token, StringComparison.OrdinalIgnoreCase);
}

internal sealed record ResolvedPage(string Id, string Name, string FullPath);
