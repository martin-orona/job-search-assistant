using JobSearchAssistant.DB;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace JobSearchAssistant.Server.Tests;

public sealed class TestDatabaseFlowTests : SqliteTestBase
{
    public TestDatabaseFlowTests() : base("jobsearchassistant-test-database-flow-tests")
    {
    }

    [Fact]
    public async Task ApplyAsync_UsesFlowSpecificDatabase_AndRemovesItOnCleanup()
    {
        RunMigrations();

        var flowId = "db-viewer-scenario";
        var originalLocalFolder = FileLifecycleManager.LocalFolder;
        var originalCloudFolder = FileLifecycleManager.CloudFolder;

        var context = new DefaultHttpContext();
        context.Request.Headers["X-JSA-Test-Flow"] = flowId;

        await TestDatabaseFlow.ApplyAsync(context, new TestEnvironment());

        var flowLocalFolder = FileLifecycleManager.GetTestDatabaseFolder(flowId);
        Assert.Equal(originalLocalFolder, FileLifecycleManager.LocalFolder);
        Assert.Equal(originalCloudFolder, FileLifecycleManager.CloudFolder);
        Assert.True(Directory.Exists(flowLocalFolder));
        Assert.True(File.Exists(Path.Combine(flowLocalFolder, "JobSearchAssistant.db")));

        context.Request.Headers["X-JSA-Test-Cleanup"] = "true";
        await TestDatabaseFlow.ApplyAsync(context, new TestEnvironment());

        Assert.False(Directory.Exists(flowLocalFolder));
    }

    [Fact]
    public async Task InvokeAsync_EndpointUsesFlowDatabase_AfterAsyncInitialization()
    {
        RunMigrations();
        const string flowId = "job-postings-endpoint-isolation";
        var originalPath = FileLifecycleManager.LocalDbPath;
        var context = new DefaultHttpContext();
        context.Request.Headers[TestDatabaseFlow.FlowHeaderName] = flowId;

        await TestDatabaseFlow.InvokeAsync(context, new TestEnvironment(), EndpointAsync);

        Assert.Equal(originalPath, FileLifecycleManager.LocalDbPath);

        async Task EndpointAsync()
        {
            await Task.Yield();
            Assert.Equal(
                Path.Combine(FileLifecycleManager.GetTestDatabaseFolder(flowId), "JobSearchAssistant.db"),
                FileLifecycleManager.LocalDbPath);
            using var connection = Database.Connect();
            Assert.Equal(FileLifecycleManager.LocalDbPath, connection.DataSource);
        }
    }

    [Fact]
    public async Task ApplyAsync_UsesSingleInitializationLock_ForConcurrentRequests()
    {
        RunMigrations();

        const string flowId = "db-viewer-concurrent-scenario";
        var tasks = Enumerable.Range(0, 25)
            .Select(_ =>
            {
                var context = new DefaultHttpContext();
                context.Request.Headers["X-JSA-Test-Flow"] = flowId;
                return TestDatabaseFlow.ApplyAsync(context, new TestEnvironment());
            })
            .ToArray();

        await Task.WhenAll(tasks);

        var flowLocalFolder = FileLifecycleManager.GetTestDatabaseFolder(flowId);
        Assert.True(Directory.Exists(flowLocalFolder));
        Assert.True(File.Exists(Path.Combine(flowLocalFolder, "JobSearchAssistant.db")));

        var cleanupContext = new DefaultHttpContext();
        cleanupContext.Request.Headers["X-JSA-Test-Flow"] = flowId;
        cleanupContext.Request.Headers["X-JSA-Test-Cleanup"] = "true";
        await TestDatabaseFlow.ApplyAsync(cleanupContext, new TestEnvironment());

        Assert.False(Directory.Exists(flowLocalFolder));
    }

    [Fact]
    public async Task CleanTestDb_WithFlowId_PreservesOtherFlowDatabases()
    {
        const string targetFlow = "job-postings-cleanup-target";
        const string otherFlow = "job-postings-cleanup-other";
        foreach (var flowId in new[] { targetFlow, otherFlow })
        {
            var request = new DefaultHttpContext();
            request.Request.Headers[TestDatabaseFlow.FlowHeaderName] = flowId;
            await TestDatabaseFlow.ApplyAsync(request, new TestEnvironment());
        }

        var cleanup = new DefaultHttpContext();
        cleanup.Request.Headers[TestDatabaseFlow.FlowHeaderName] = targetFlow;
        cleanup.Request.Headers[TestDatabaseFlow.CleanupHeaderName] = "true";
        await TestDatabaseFlow.CleanTestDb(cleanup, new TestEnvironment());

        Assert.False(Directory.Exists(FileLifecycleManager.GetTestDatabaseFolder(targetFlow)));
        Assert.True(File.Exists(Path.Combine(FileLifecycleManager.GetTestDatabaseFolder(otherFlow), "JobSearchAssistant.db")));
    }

    [Fact]
    public void DeleteTestDatabase_RemovesFolderEvenWhenTrackedSqliteConnectionIsOpen()
    {
        var flowId = "db-viewer-open-connection-scenario";
        FileLifecycleManager.SetTestDatabase(flowId);

        var folder = FileLifecycleManager.GetTestDatabaseFolder(flowId);
        Directory.CreateDirectory(folder);

        var databasePath = Path.Combine(folder, "JobSearchAssistant.db");
        File.WriteAllText(databasePath, "test");

        using var connection = Database.Connect();

        FileLifecycleManager.DeleteTestDatabase(flowId);

        Assert.False(Directory.Exists(folder));
    }

    private sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "JobSearchAssistant.Server.Tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
