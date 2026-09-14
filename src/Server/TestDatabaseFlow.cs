namespace JobSearchAssistant.Server;

using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

using JobSearchAssistant.DB;

using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;

public static class TestDatabaseFlow
{
    public const string FlowHeaderName = "X-JSA-Test-Flow";
    public const string CleanupHeaderName = "X-JSA-Test-Cleanup";
    private const string FlowCookieName = "jsa_test_flow";
    private const string CleanupCookieName = "jsa_test_cleanup";
    private static readonly SemaphoreSlim DatabaseFlowLock = new(1, 1);

    public static async Task ApplyAsync(HttpContext context, IHostEnvironment environment)
    {
        // don't do anything if route /admin/clean-test-db is called
        if (context.Request.Path.StartsWithSegments($"{Program.RoutePrefix_APIv1}/admin/clean-test-db"))
        {
            return;
        }

        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(environment);

        var isTestAwareEnvironment = environment.IsDevelopment()
            || environment.IsEnvironment("Testing")
            || environment.IsEnvironment("Test");

        if (!isTestAwareEnvironment)
        {
            await RunWithWriteLockAsync(() =>
            {
                FileLifecycleManager.ClearTestDatabase();
                return Task.CompletedTask;
            });
            return;
        }

        var flowId = ReadValue(context, FlowHeaderName, FlowCookieName);
        var cleanup = IsCleanupRequested(context);

        if (cleanup)
        {
            Console.WriteLine($"[TEST] detected flow ID: {flowId}");
            Console.WriteLine($"[TEST] cleanup requested: {cleanup}");
            await RunWithWriteLockAsync(() =>
            {
                if (!string.IsNullOrWhiteSpace(flowId))
                {
                    FileLifecycleManager.DeleteTestDatabase(flowId);
                }
                else
                {
                    FileLifecycleManager.ClearTestDatabase();
                }

                return Task.CompletedTask;
            });
            return;
        }

        if (string.IsNullOrWhiteSpace(flowId))
        {
            await RunWithWriteLockAsync(() =>
            {
                FileLifecycleManager.ClearTestDatabase();
                return Task.CompletedTask;
            });
            return;
        }

        await RunWithWriteLockAsync(() =>
        {
            Console.WriteLine($"[TEST] setting up test database for flow ID: {flowId}");
            FileLifecycleManager.SetTestDatabase(flowId);
            var databasePath = Path.Combine(FileLifecycleManager.GetTestDatabaseFolder(flowId), "JobSearchAssistant.db");
            if (!File.Exists(databasePath))
            {
                Console.WriteLine("[TEST] Creating new test database...");
                Database.RunMigrations();
            }

            return Task.CompletedTask;
        });
    }

    public static async Task<IResult> CleanTestDb(HttpContext context, IHostEnvironment environment)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(environment);

        var isTestAwareEnvironment = environment.IsDevelopment()
            || environment.IsEnvironment("Testing")
            || environment.IsEnvironment("Test");
        if (!isTestAwareEnvironment)
        {
            return TypedResults.BadRequest("Test database operations are only allowed in development or test environments.");
        }

        var flowId = ReadValue(context, FlowHeaderName, FlowCookieName);
        if (string.IsNullOrWhiteSpace(flowId))
        {
            return TypedResults.BadRequest("Test workflow header/cookie is not set.");
        }

        var cleanup = IsCleanupRequested(context);
        if (!cleanup)
        {
            return TypedResults.BadRequest("Cleanup header/cookie is not set.");
        }

        Console.WriteLine($"[TEST] detected flow ID: {flowId}");
        Console.WriteLine($"[TEST] cleanup requested: {cleanup}");
        return await RunWithWriteLockAsync(() =>
        {
            FileLifecycleManager.DeleteTestDatabase(flowId);
            return Task.FromResult(TypedResults.Ok());
        });
    }

    private static async Task RunWithWriteLockAsync(Func<Task> operation) => await RunWithWriteLockAsync(async () =>
                                                                                  {
                                                                                      await operation();
                                                                                      return Task.CompletedTask;
                                                                                  });

    private static async Task<T> RunWithWriteLockAsync<T>(Func<Task<T>> operation)
    {
        await DatabaseFlowLock.WaitAsync();
        try
        {
            return await operation();
        }
        finally
        {
            DatabaseFlowLock.Release();
        }
    }

    private static bool IsCleanupRequested(HttpContext context)
    {
        var cleanupValue = ReadValue(context, CleanupHeaderName, CleanupCookieName);
        if (string.IsNullOrWhiteSpace(cleanupValue))
        {
            return false;
        }

        return cleanupValue.Equals("true", StringComparison.OrdinalIgnoreCase)
            || cleanupValue.Equals("1", StringComparison.OrdinalIgnoreCase)
            || cleanupValue.Equals("yes", StringComparison.OrdinalIgnoreCase)
            || cleanupValue.Equals("on", StringComparison.OrdinalIgnoreCase);
    }

    private static string? ReadValue(HttpContext context, string headerName, string cookieName)
    {
        if (context.Request.Headers.TryGetValue(headerName, out var headerValue) && !string.IsNullOrWhiteSpace(headerValue))
        {
            return headerValue.ToString();
        }

        if (context.Request.Cookies.TryGetValue(cookieName, out var cookieValue) && !string.IsNullOrWhiteSpace(cookieValue))
        {
            return cookieValue;
        }

        return null;
    }
}
