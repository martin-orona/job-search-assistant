# Project Context

- **Owner:** Martin
- **Project:** job-search-assistant
- **Stack:** C# .NET API, SQLite synchronized through OneDrive, React, TypeScript, Edge extension, MAUI
- **Created:** 2026-09-01T04:49:04.029Z

## Learnings

- Prioritize workflow coverage across job capture, resume comparison, tailoring, and application tracking.
- Persistence tests should verify the raw SQLite representation when storage changes.

## Team Updates

📌 Team update (2026-08-31T00:00:00Z): CRUD validation now runs through a single
`ValidationMode`-parameterized `CrudValidator` pipeline. `[RequiredWhenCreating]` and
`[RequiredWhenUpdating]` are enforced for the first time — previously only `[Required]` was, so
existing fixtures that omitted those fields may now fail validation. `CrudValidatorTests` coverage
is an open gap; the refactor was verified by language-server diagnostics only, not `dotnet test`.
— decided by Backend

📌 Team update (2026-09-01T00:00:00Z): Five new AiPrompt create tests were added and two pre-existing
tests were corrected — they passed already-persisted nested objects into Create, which is now a
validation error (and was already broken). NONE OF THIS WAS RUN: no terminal was available, so
`dotnet build` and `dotnet test` did not execute. Treat the suite as unverified until a real test run
confirms it. Also still open from the previous pass: `CrudValidatorTests` coverage. — decided by Backend

📌 Team update (2026-09-01T00:00:00Z): The suite HAS now been run — DB.Tests 54/54, Server.Tests
27/27, `dotnet build src/DB/DB.csproj` clean, verified independently by the coordinator. Five Server
failures were found and fixed; all five were stale fixtures, not defects.

**Test-quality debt — worth your attention.** `AiPrompts_CreateRoute` and `JobPostings_CreateRoute`
were asserting on `context.Response.StatusCode` of a `DefaultHttpContext` whose status was never
written, because `await result.ExecuteAsync(context)` is commented out. The assertion was reading the
200 default and passed no matter what the handler did — **a vacuous assertion**. Backend repointed it
at `responsePayload.StatusCode`, which is real but still does not exercise the result pipeline.
`ExecuteAsync` remains disabled because `CreateContext()` registers `AddRouting()` without the named
endpoints, so `CreatedAtRoute` link generation would throw. Two jobs here: (1) make `CreateContext()`
register the named endpoints so the pipeline can actually run, and (2) **hunt for this pattern
elsewhere** — any assertion against a `DefaultHttpContext` response that was never written to is
green by construction. — recorded by Scribe
