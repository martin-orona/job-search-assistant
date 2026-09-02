namespace JobSearchAssistant.DB.Services;

using JobSearchAssistant.DB.Models;

public class Resumes : ModelWithDocumentCrud<Resume>
{
    static Resumes() => CRUD.RegisterCrudInfo<Resume>("resume");

    public Resumes() : base("resume")
    {
    }
}
