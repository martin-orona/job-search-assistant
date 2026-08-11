using System.Xml.Linq;

namespace JobSearchAssistant.Core.OneNote;

/// <summary>
/// Locates the heading anchor within page content XML and returns the
/// ordered OE elements that fall within its scope.
/// </summary>
internal static class PageScoper
{
    /// <summary>
    /// Returns all OE (outline element) nodes in <paramref name="pageXml"/>
    /// that are within the scope of <paramref name="headerText"/>.
    /// Scope ends before the next heading at the same or higher level.
    /// </summary>
    public static IReadOnlyList<OeElement> GetScopedElements(
        string pageXml,
        string headerText,
        IReadOnlyDictionary<int, string> styleIndex)
    {
        var doc = XDocument.Parse(pageXml);
        var ns = doc.Root!.GetDefaultNamespace();
        var oeTag = ns + "OE";
        var tTag  = ns + "T";

        // Flatten all OEs in document order (breadth-across, depth-into-OEChildren)
        var allOes = doc.Descendants(oeTag)
            .Select((oe, i) =>
            {
                var qsi = (int?)oe.Attribute("quickStyleIndex") ?? 0;
                var styleName = styleIndex.TryGetValue(qsi, out var s) ? StyleAliasMap.Normalise(s) : "Normal";
                var text = string.Concat(oe.Elements(tTag).Select(t => t.Value)).Trim();
                var objectId = (string?)oe.Attribute("objectID") ?? "";
                return new OeElement(i, styleName, text, objectId, oe);
            })
            .ToList();

        // Find anchor heading
        var anchorIndex = allOes.FindIndex(oe =>
            string.Equals(oe.Text, headerText.Trim(), StringComparison.OrdinalIgnoreCase));

        if (anchorIndex < 0)
            throw new SyncException(SyncErrorCode.HeaderNotFound,
                $"Header '{headerText}' not found on the page.");

        int anchorLevel = StyleAliasMap.HeadingLevel(allOes[anchorIndex].Style);

        // Collect elements after anchor until a same-or-higher-level heading appears
        var scoped = new List<OeElement>();
        for (int i = anchorIndex + 1; i < allOes.Count; i++)
        {
            var oe = allOes[i];
            int level = StyleAliasMap.HeadingLevel(oe.Style);
            if (level > 0 && level <= anchorLevel)
                break;
            scoped.Add(oe);
        }

        return scoped;
    }

    /// <summary>
    /// Builds the quickStyleIndex → raw style name map from page XML QuickStyleDef elements.
    /// </summary>
    public static IReadOnlyDictionary<int, string> BuildStyleIndex(string pageXml)
    {
        var doc = XDocument.Parse(pageXml);
        var ns = doc.Root!.GetDefaultNamespace();
        return doc.Descendants(ns + "QuickStyleDef")
            .ToDictionary(
                el => (int)(el.Attribute("index") ?? throw new InvalidOperationException("Missing index")),
                el => (string?)el.Attribute("name") ?? "p");
    }
}

internal sealed record OeElement(int Order, string Style, string Text, string ObjectId, XElement Raw);
