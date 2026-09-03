namespace JobSearchAssistant.DB.Models;

using JobSearchAssistant.Core;

public class Model
{
    [RequiredWhenUpdating]
    public int Id { get; set; }

    public DateTimeOffset CreatedAt { get; set; } // = DateTime.UtcNow.ToString("o");

    public DateTimeOffset UpdatedAt { get; set; } // = DateTime.UtcNow.ToString("o");
}

public class ModelWithDocument : Model
{
    [RequireOneWhenCreating(nameof(Document), nameof(DocumentId))]
    public Document Document { get; set; } = null!;

    [RequiredWhenUpdating]
    public int DocumentId { get; set; }
}
