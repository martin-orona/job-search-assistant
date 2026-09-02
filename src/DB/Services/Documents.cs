namespace JobSearchAssistant.DB.Services;

using JobSearchAssistant.DB.Models;

public class Documents : ModelCrud<Document>
{
    internal const string DbTableName = "document";

    static Documents() => CRUD.RegisterCrudInfo<Document>(DbTableName);

    public Documents() : base(DbTableName)
    {
    }
}
