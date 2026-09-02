namespace JobSearchAssistant.Core;

using System.ComponentModel.DataAnnotations;

public class ValidationError
{
    required public string Field { get; set; }

    required public string Message { get; set; }
}

public class RequiredWhenCreatingAttribute : ValidationAttribute
{

}

public class RequiredWhenUpdatingAttribute : ValidationAttribute
{

}

public class RequireOneWhenCreatingAttribute : ValidationAttribute
{
    public RequireOneWhenCreatingAttribute(string firstProperty, string secondProperty) : base($"When creating a new record, either [{firstProperty}] or [{secondProperty}] must be provided.")
    {
        this.FirstProperty = firstProperty;
        this.SecondProperty = secondProperty;
    }

    public string FirstProperty { get; }

    public string SecondProperty { get; }
}