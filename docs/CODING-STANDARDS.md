# Coding Standards and Patterns

## Scope

These standards apply to all source code, database migrations, tests, and
documentation in this repository. Prefer a small, complete change over broad
refactoring.

## General practices

- Preserve existing behavior unless the change explicitly requires otherwise.
- Investigate existing helpers and patterns before adding new abstractions.
- Keep changes focused; do not clean up unrelated code in the same change.
- Prefer clear names and straightforward control flow over cleverness.
- Surface invalid input and operational errors; do not silently swallow failures.
- Use comments sparingly, only where the intent is not obvious from the code.

## C# and .NET

- Follow the nullable and implicit-using settings in each project.
- Use the existing file-scoped namespace and formatting style for the
  surrounding project.
- Prefer strong types and existing domain models over stringly typed values.
- Avoid unnecessary casts and broad exception handling.
- Keep shared behavior in the existing service or utility layer rather than
  duplicating it in endpoints or UI code.

## Persistence

- SQLite column names use `snake_case`; C# properties use `PascalCase`.
- Database access goes through `Database` and the DB service/CRUD layer.
- Enum values persisted to human-readable text columns must be written using
  their enum names, not their underlying numeric values.
- Create related records as one object graph when the parent model exposes the
  child model as a property. For example, create a `JobPosting`, `Resume`, or
  `AiPrompt` with its `Document` children assigned to the parent, rather than
  creating each document in separate calls and passing only its ID.
- The CRUD layer persists nested model properties in one database transaction.
  Splitting a workflow into multiple create calls breaks that atomicity and can
  leave orphaned records when a later call fails.
- Delete workflows must also be atomic. Multi-record or cascade deletes must be
  handled in the server-side transaction, not by a UI that fires several delete
  requests in sequence. A failed middle step must roll back the entire operation
  so the database stays consistent.
- When a delete is rejected by a foreign-key or validation rule, the server must
  return a user-facing error that identifies the relevant entity or record so the
  user knows what to resolve. The UI should only present the server error; it
  should not continue a partial delete flow after a failed step.

- A child object must have `Id == 0` (new record) or `Id > 0` with no parent link attempt (error).
- A foreign key ID of `0` means "not provided"; FK IDs in create mode must be `> 0` if using the FK path.
- Negative ID values (`< 0`) are always invalid and rejected during validation.

| Nested object         | Foreign key id | Result                                       |
| --------------------- | -------------- | -------------------------------------------- |
| absent                | not set        | Error — neither was provided                 |
| present, `Id` not set | not set        | Valid — the child is created                 |
| absent                | `7`            | Valid — links to existing record `7`         |
| present, `Id` not set | `7`            | Error — only one may be provided             |
| present, `Id` is set  | any            | Error — a child object may not carry an `Id` |

Creating the child, and linking to an existing one:

```json
{ "name": "match review", "jobPosting": { "title": "Staff Engineer", "company": "Fabrikam" } }
{ "name": "match review", "jobPostingId": 7 }
```

A child object carrying an `Id` is rejected; send the foreign key id instead:

```json
{ "name": "match review", "jobPosting": { "id": 7 } }
```

Negative or zero FK IDs are rejected:

```json
{ "name": "match review", "jobPostingId": 0 }
{ "name": "match review", "jobPostingId": -1 }
```

### Update-path id contract

Updating a record targets it by an already-assigned id, so that id — the route
id for the top-level record, and the nested model's own `Id` at every
recursion level — must be greater than 0. A request body's top-level `Id`
field is not read for this check; the route id is what's validated and then
assigned onto the model. Nested model objects carry their own `Id` in the
body (for example `document.id`), and that value is validated the same way
when the nested record is updated. The same rule applies to patch (partial
update): the route id and every nested object's `"id"` field must be greater
than 0.

```json
PUT /job-postings/7
{ "title": "Staff Engineer", "document": { "id": 3, "title": "..." } }

PATCH /job-postings/7
{ "document": { "id": 3, "title": "..." } }
```

`7` and `3` must both be greater than 0; `PUT`/`PATCH /job-postings/0` or a
nested `"id": -1` are rejected during validation before any database write.

### Nested model / foreign key id agreement (update and patch)

Every nested `Model`-typed property that has a sibling `{PropertyName}Id`
property (for example `Document`/`DocumentId`, `JobPosting`/`JobPostingId`) is
paired automatically by convention at CRUD registration time
(`CrudInfoGeneration.GetIdsMustMatchGroups<T>`) — no attribute is needed. A
missing `{PropertyName}Id` sibling is the natural opt-out: it means there is
nothing to reconcile, not that a rule was forgotten. When updating or patching
a record, if a nested child object with a non-zero `Id` and its paired foreign
key id are both provided, they must agree; if only one is provided, there is
nothing to check (the create-path table above already governs that case, and
create itself forbids providing both). This is a codebase-wide invariant: a
new `Model`-typed property automatically gets this check for free as long as
it follows the `{PropertyName}Id` naming convention already used everywhere
else.

```json
PATCH /resumes/7
{ "documentId": 3, "document": { "id": 9, "title": "..." } }
```

The above is rejected — `document.id` (`9`) and `documentId` (`3`) disagree.

## HTTP and JSON

- Keep route wiring in the relevant server endpoint class.
- Reuse the shared controller and CRUD behavior for standard operations.
- Use the configured JSON enum representation consistently.
- Server calls should represent a complete user workflow. Submit related
  objects, including document children, in a single request so the server can
  perform the workflow transactionally. Related objects in a create request must
  follow the [create-path object graph contract](#create-path-object-graph-contract).
- Validate and report malformed requests rather than returning success-shaped
  fallbacks.

## Front-End and CSS

- Prefer full descriptive names (`button`) over cryptic abbreviations (`btn`).
  Abbreviated class names save negligible network payload while increasing code cognitive load.
- Use BEM-style `--` double-dash delimiters to separate variant and semantic modifier meanings in class names (e.g., `button--primary`, `button--delete`).
- Add ID attributes to the expanders and other elements that take user input, to make it easier to track and test them.
- Consolidate common component styling into shared utility classes across tabs and components for consistent behavior and appearance.

## Tests

- Put database tests under `/tests/JobSearchAssistant.DB.Tests`.
- Put web server tests under `/tests/JobSearchAssistant.Server.Tests`
- Put end to end tests under `/tests/Web.Ui.Tests/e2e/`.

### General

- Follow the existing xUnit naming and fixture patterns.
- Test both the public behavior and important storage details when persistence
  is involved.
- Documentation is part of the behavior contract: a new test without a matching scenario is considered incomplete.
- When adding or changing behavior tests, update the test documentation at the same time.
- If the same test pattern is reused across multiple controls or components, prefer a Scenario Outline with Examples instead of repeating the same scenario.
- Keep the scenario description in user terms and match the actual control IDs/selectors used by the implementation and automated tests.
- Run the smallest relevant test filter first, then the full affected suite.

### End to End (e2e)

- End-to-end tests run against a real server and database boundary, not a mocked API layer.
- Each browser test flow gets a unique identifier so the server can attach the request to a disposable database.
- Prefer a request header or cookie named for the test flow (header: `X-JSA-Test-Flow` or cookie:`jsa_test_flow`) so a human can also set it manually in the browser when debugging.
- When the server sees a new test flow id, it creates a new database for that flow and runs the schema/bootstrap setup before the request continues.
- When the server sees a cleanup signal for that flow id (header:`X-JSA-Test-Cleanup: true` or cookie:`jsa_test_cleanup:true`), it destroys only that flow's database and removes any leftover state for that flow.
- At startup, delete any leftover databases matching the test prefix so failed or interrupted runs do not pollute the next suite.
- Only test databases that match a safe prefix, e.g. `jsa_test_`, are eligible for creation or deletion. The real production database must never be targeted by this path.
- The test middleware should be behind an explicit test/dev guard so production traffic never triggers database creation or teardown.
- Do not write race-prone UI tests that assert against unrelated async state changes. A test must wait for the specific browser event or condition that proves the behavior under test; do not assert a final status text while a mount-time refresh, animation, or background update can overwrite it.
- When a UI state is intentionally transient, assert the lifecycle (for example, add then remove a highlight or class) instead of the final state after the animation has already completed.
- If a component updates status in several places, the test must account for those side effects explicitly or avoid asserting the stale one altogether.
- When debugging a failing browser regression, start with a single exact scenario or a focused sibling test in the same spec file. Do not keep broadening the test search with ad hoc CLI variants or speculative edits. Narrow to the real failing case, confirm the reproduction, fix the root cause, then re-run the related group.

## Documentation

- Update documentation when a change introduces or alters a repository-wide
  convention.
- Link related documents instead of duplicating guidance.
- Keep instructions actionable for both humans and AI coding agents.
