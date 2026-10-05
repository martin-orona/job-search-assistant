namespace JobSearchAssistant.Server;

using System;
using System.Text.Json.Serialization;
using System.Threading;

using JobSearchAssistant.DB;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

using Serilog;
using Serilog.Context;
using Serilog.Core;
using Serilog.Events;
using Serilog.Sinks.SystemConsole.Themes;

public class Program
{
    public const string RoutePrefix_APIv1 = "/api/v1";

    internal static bool IsInDevMode { get; private set; } = false;

    public static void Main(string[] args)
    {
        try
        {
            InitializeLogging();
            InitializeTheDatabase();
            var app = InitializeWebApplication(args);
            InitializeRoutes(app);

            Log.Information("Web service running. Open {URL} in your browser.", "http://localhost:5000/index.html");
            app.Run("http://localhost:5000");
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "Application startup failed.");
            throw;
        }
        finally
        {
            Log.CloseAndFlush();
        }
    }

    internal static bool IsInDevelopmentMode(WebApplication app)
    {
        string coreEnv = app.Environment.EnvironmentName ?? "Unknown";
        string appMode = app.Configuration["APP_MODE"] ?? Environment.GetEnvironmentVariable("APP_MODE") ?? "Unknown";

        var testEnvs = new[] { "Testing", "Test", "Development", "Dev" };
        bool isDevEnvironment = testEnvs.Contains(appMode) || testEnvs.Contains(coreEnv);

        return isDevEnvironment;
    }

    private static WebApplication InitializeWebApplication(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Host.UseSerilog();

        builder.Services.Configure<JsonOptions>(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
            options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        });

        builder.Services.AddCors();

        var app = builder.Build();

        app.Use(async (context, next) =>
        {
            // The correlation ID will cover all logs within this request's context
            var correlationId = LogCounters.CorrelationId.Next().ToString();
            context.Items["CorrelationId"] = correlationId;
            context.Response.Headers["X-Correlation-ID"] = correlationId;

            using (LogContext.PushProperty("CorrelationId", correlationId))
            {
                var logger = context.RequestServices
                    .GetRequiredService<ILoggerFactory>()
                    .CreateLogger("RequestLifecycle");

                string barrier = new string('=', 40);
                logger.LogInformation(barrier);
                logger.LogInformation(barrier);
                logger.LogInformation(
                    $"BEGIN {context.Request.Protocol}" + " {Method} {URL}",
                    context.Request.Method,
                    $"{context.Request.Scheme}://{context.Request.Host}{context.Request.PathBase}{context.Request.Path}{context.Request.QueryString}");

                await next();

                logger.LogInformation(
                    $"END {context.Request.Protocol}" + " {Method} {URL}",
                    context.Request.Method,
                    $"{context.Request.Scheme}://{context.Request.Host}{context.Request.PathBase}{context.Request.Path}{context.Request.QueryString}");
                logger.LogInformation(barrier);
                logger.LogInformation(barrier);
            }
        });

        IsInDevMode = IsInDevelopmentMode(app);

        if (IsInDevMode)
        {
            app.UseDeveloperExceptionPage();
        }

        if (IsInDevMode)
        {
            app.Use(async (context, next) =>
            {
                var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();

                logger.LogInformation($"[TEST] processing request {context.Request.Method} {context.Request.Path}");

                /*  // log out the headers for debugging purposes
                    foreach (var header in context.Request.Headers)
                    {
                        logger.LogInformation($"[TEST] Header: {header.Key} = {header.Value}");
                    } */

                await TestDatabaseFlow.InvokeAsync(context, app.Environment, () => next());
            });
        }

        app.UseStaticFiles();
        app.UseCors(policy => policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());

        app.Lifetime.ApplicationStopping.Register(() =>
        {
            Database.Shutdown();
        });

        return app;
    }

    private static void InitializeRoutes(WebApplication app)
    {
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
    }

    private static void InitializeLogging() => Log.Logger = new LoggerConfiguration()
        .Enrich.FromLogContext()
        .Enrich.With(new SequentialLogEntryIdEnricher())
        .WriteTo.Console(
            outputTemplate: "[{Timestamp:HH:mm:ss} {CorrelationId}:{LogEntryId} {Level:w3}] {Message:lj}{NewLine}{Exception}",
            theme: AnsiConsoleTheme.Sixteen
        )
        .CreateLogger();

    private static void InitializeTheDatabase()
    {
        var settings = Core.Configuration.LoadAppSettings("appsettings.json");

        Database.Startup(settings);
        Database.RunMigrations();
        FileLifecycleManager.CleanupStaleTestDatabases();
    }
}

public sealed class AtomicCounter
{
    private long _value = 0;

    /* NOTE: If this ever gets scaled horizontally across multiple instances,
    this sequential correlation ID will not be unique across instances. */
    public long Next() => Interlocked.Increment(ref _value);
}

public static class LogCounters
{
    public static readonly AtomicCounter LogEntryId = new AtomicCounter();
    public static readonly AtomicCounter CorrelationId = new AtomicCounter();
}

public class SequentialLogEntryIdEnricher : ILogEventEnricher
{
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        var id = LogCounters.LogEntryId.Next();
        var property = propertyFactory.CreateProperty("LogEntryId", id);
        logEvent.AddPropertyIfAbsent(property);
    }
}