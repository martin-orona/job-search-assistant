using System.Security.Cryptography;
using System.Text;

namespace JobSearchAssistant.Core;

/// <summary>
/// Produces a deterministic, collision-resistant key from page identity and paragraph fingerprint.
/// </summary>
public static class SourceKeyGenerator
{
    public static string Generate(string oneNotePath, string headerText, string paragraphFingerprint)
    {
        var raw = $"{oneNotePath.Trim()}|{headerText.Trim()}|{paragraphFingerprint.Trim()}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(hash)[..16];
    }
}
