namespace JobSearchAssistant.Core;

public class AppException : Exception
{
    public AppException(string message) : base(message)
    {
    }

    public AppException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

public class NotFoundException : AppException
{
    public NotFoundException(string message) : base(message)
    {
    }

    public NotFoundException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

public class DatabaseException : AppException
{
    public DatabaseException(string message) : base(message)
    {
    }

    public DatabaseException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

public class BadRequestException : AppException
{
    public BadRequestException(string message) : base(message)
    {
    }

    public BadRequestException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

public class ValidationException : AppException
{
    public ValidationException(string message, IReadOnlyList<ValidationError> validationErrors) : this(message, validationErrors, null)
    {
    }

    public ValidationException(string message, IReadOnlyList<ValidationError> validationErrors, Exception innerException)
    : base(ExpandMessage(message, validationErrors), innerException)
    {
        // : base(message, innerException) => this.ValidationErrors = validationErrors;
        this.ValidationErrors = validationErrors;
    }

    public IReadOnlyList<ValidationError> ValidationErrors { get; }

    private static string ExpandMessage(string message, IReadOnlyList<ValidationError> errors)
    {
        var mergedErrors = string.Join("," + Environment.NewLine, errors.Select(e => '"' + e.Message + '"'));
        return $"{message} Validation Errors: [{mergedErrors}]";
    }
}