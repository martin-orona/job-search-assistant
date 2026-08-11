using System.Security.Cryptography;
using System.Text;

namespace JobSearchAssistant.Core.OneNote;

/// <summary>
/// Filters scoped OE elements by style and produces <see cref="OneNoteParagraph"/> records.
/// </summary>
internal static class ParagraphFilter
{
    public static IReadOnlyList<OneNoteParagraph> Filter(
        IReadOnlyList<OeElement> scopedElements,
        string paragraphStyle)
    {
        var canonical = StyleAliasMap.Normalise(paragraphStyle);

        return scopedElements
            .Where(oe => string.Equals(oe.Style, canonical, StringComparison.OrdinalIgnoreCase))
            .Where(oe => oe.Text.Length > 0)
            .Select(oe => new OneNoteParagraph
            {
                Text = oe.Text,
                Fingerprint = ComputeFingerprint(oe.Text),
                Locator = oe.ObjectId.Length > 0
                    ? oe.ObjectId
                    : $"order:{oe.Order}",
                Style = oe.Style,
                Order = oe.Order
            })
            .ToList();
    }

    private static string ComputeFingerprint(string text)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(text.Trim()));
        return Convert.ToHexString(hash)[..12];
    }
}
