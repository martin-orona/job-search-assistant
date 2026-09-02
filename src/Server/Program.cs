namespace JobSearchAssistant.Server;

using System;
using System.Net.Http;
using System.Text.Json.Serialization;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

using JobSearchAssistant.DB;

public class Program
{
    private static readonly HttpClient HttpClient = new HttpClient();

    public static void Main(string[] args)
    {
        var settings = Core.Configuration.LoadAppSettings("appsettings.json");

        Database.Startup(settings);
        Database.RunMigrations();

        var builder = WebApplication.CreateBuilder(args);

        builder.Services.Configure<JsonOptions>(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });

        builder.Services.AddCors();

        var app = builder.Build();

        if (builder.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        app.UseStaticFiles();
        app.UseCors(policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());

        app.MapGet("/", () => "hello world");
        var api = app.MapGroup("/api/v1");
        var admin = Admin.Map(api);
        var docs = new Documents().Map(api);
        var jobPostings = new JobPostings().Map(api);
        var aiPromptTemplates = new AiPromptTemplates().Map(api);
        var resumes = new Resumes().Map(api);
        var aiPrompts = new AiPrompts().Map(api);

        app.Lifetime.ApplicationStopping.Register(() =>
       {
           Database.Shutdown();
       });

        Console.WriteLine("\n[Server] Web service running. Open http://localhost:5000/index.html in your browser.");
        app.Run("http://localhost:5000");
    }
}
