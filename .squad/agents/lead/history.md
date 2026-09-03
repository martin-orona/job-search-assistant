# Project Context

- **Owner:** Martin
- **Project:** job-search-assistant
- **Stack:** C# .NET API, SQLite synchronized through OneDrive, React, TypeScript, Edge extension, MAUI
- **Created:** 2026-09-01T04:49:04.029Z

## Learnings

- React and TypeScript are the primary user interface.
- Edge extension capture is required because Indeed cannot load in an iframe.

📌 Team update (2026-09-01T00:00:00Z): **Open question needing a call.** The AiPrompt controller
fixtures were writing FK values of `0` into `ai_prompt` (`prompt_document_id`,
`response_document_id`) and the tests still passed. That appears to contradict the earlier finding
that the FK constraints from migration `0005` are live and that `Database.Connect()` issues
`PRAGMA foreign_keys = ON` per connection. Either enforcement is not taking effect on that path, or
the columns permit `0`. This matters beyond the fixtures: several validation decisions this session
leaned on "foreign key integrity is enforced by the database" as the reason validation does not need
to check it. If that premise is false, the create-path contract has a hole. Needs investigation.

Context: the create-path object graph contract was settled this session — a child object means
create, an FK id means link. Merged to `.squad/decisions.md`. Verified green: DB.Tests 54/54,
Server.Tests 27/27. — recorded by Scribe

📌 Team update (2026-09-02T00:00:00Z): Recommended convention-based IdsMustMatchGroup derivation from {PropertyName}Id naming for Update/Patch child-object-vs-foreign-key consistency, over the existing (unenforced) attribute. Backend implemented it as recommended — decided by Lead.
