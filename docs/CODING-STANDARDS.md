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
- When changing persistence representation, add a numbered migration that
  converts existing values and keeps legacy reads safe where practical.
- Add a regression test that checks the raw stored representation, not only the
  round-tripped model value.

### Create-path object graph contract

A child object means create it; a foreign key id means link to it. Sending a
child model at creation time is a request to insert that child, so exactly one
of the child object or the `{PropertyName}Id` foreign key may be supplied, and
a supplied child object must be new — its `Id` must not be set.

**ID Validation Rule:** All ID values (primary keys and foreign keys) must be greater than 0 if provided.
- A child object must have `Id == 0` (new record) or `Id > 0` with no parent link attempt (error).
- A foreign key ID of `0` means "not provided"; FK IDs in create mode must be `> 0` if using the FK path.
- Negative ID values (`< 0`) are always invalid and rejected during validation.

| Nested object | Foreign key id | Result |
| --- | --- | --- |
| absent | not set | Error — neither was provided |
| present, `Id` not set | not set | Valid — the child is created |
| absent | `7` | Valid — links to existing record `7` |
| present, `Id` not set | `7` | Error — only one may be provided |
| present, `Id` is set | any | Error — a child object may not carry an `Id` |

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
  Abbreviated class names save negligible network payload while increasing code
  cognitive load.
- Use BEM-style `--` double-dash delimiters to separate variant and semantic
  modifier meanings in class names (e.g., `button--primary`, `button--delete`,
  `button--sm`).
- Consolidate common component styling into shared utility classes across tabs and
  components for consistent behavior and appearance.

## Tests

- Put database tests under `tests/JobSearchAssistant.DB.Tests`.
- Follow the existing xUnit naming and fixture patterns.
- Test both the public behavior and important storage details when persistence
  is involved.
- Run the smallest relevant test filter first, then the full affected suite.

## Documentation

- Update documentation when a change introduces or alters a repository-wide
  convention.
- Link related documents instead of duplicating guidance.
- Keep instructions actionable for both humans and AI coding agents.
