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
    public const string RoutePrefix_APIv1 = "/api/v1";

    internal static bool IsInDevMode { get; private set; } = false;

    private static readonly HttpClient HttpClient = new HttpClient();

    public static void Main(string[] args)
    {
        var settings = Core.Configuration.LoadAppSettings("appsettings.json");

        Database.Startup(settings);
        Database.RunMigrations();
        FileLifecycleManager.CleanupStaleTestDatabases();

        var builder = WebApplication.CreateBuilder(args);

        builder.Services.Configure<JsonOptions>(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
            options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        });

        builder.Services.AddCors();

        var app = builder.Build();

        IsInDevMode = IsInDevevelopmentMode(app);

        if (builder.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
        }

        app.Use(async (context, next) =>
        {
            Console.WriteLine($"[TEST] processing request {context.Request.Method} {context.Request.Path}");

            // log out the headers for debugging purposes
            foreach (var header in context.Request.Headers)
            {
                Console.WriteLine($"[TEST] Header: {header.Key} = {header.Value}");
            }

            await TestDatabaseFlow.ApplyAsync(context, app.Environment);
            await next();
        });

        app.UseStaticFiles();
        app.UseCors(policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());

        app.MapGet("/", () => "hello world");
        var api = app.MapGroup(RoutePrefix_APIv1);
        var admin = Admin.Map(api, app);
        var docs = new Documents().Map(api);
        var jobPostings = new JobPostings().Map(api);
        var jobApplications = new JobApplications().Map(api);
        var jobSources = new JobSources().Map(api);
        var jobQuestions = new JobQuestions().Map(api);
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

    internal static bool IsInDevevelopmentMode(WebApplication app)
    {
        string coreEnv = app.Environment.EnvironmentName ?? "Unknown";
        string appMode = app.Configuration["APP_MODE"] ?? Environment.GetEnvironmentVariable("APP_MODE") ?? "Unknown";

        var testEnvs = new[] { "Testing", "Test", "Development", "Dev" };
        bool isDevEnvironment = testEnvs.Contains(appMode) || testEnvs.Contains(coreEnv);

        return isDevEnvironment;
    }
}
