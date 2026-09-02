# Squad Decisions

## Active Decisions

### 2026-09-01T04:49:04.029Z: Initial Squad operating model

**By:** Martin

**What:** Use descriptive Squad member names. React and TypeScript are the primary UI; the .NET API and SQLite local file synchronized through OneDrive support the application. The Edge extension owns browser automation and job capture because Indeed cannot load in an iframe. MAUI is a secondary desktop UI.

**Why:** This reflects the confirmed team roster and the product's current architecture priorities.

### 2026-08-31T00:00:00Z: CRUD validation unified behind a ValidationMode-parameterized pipeline

**By:** Backend (requested by Martin)

**What:** `CrudValidator` is now the single validation entry point for the CRUD layer. An internal
`ValidationMode` enum (Create / Update / Patch) selects which conditional required-attribute set is
unioned with `[Required]`: `RequiredWhenCreatingProperties` for Create, `RequiredWhenUpdatingProperties`
for Update and Patch. `ValidateForCreate` and `ValidateForUpdate` both delegate to one `ValidateFull`
traversal; Patch uses `ValidatePatchFields`, which applies the same required set but only to keys
actually present in the patch dictionary.

**Why:** The Create/Update/Patch workflows had near-duplicate traversal code in both `CRUD` and a
half-written `CrudValidator`. Parameterizing the rule set removes the duplication while keeping the
recursion shape and dotted error paths identical to the CRUD object-graph recursion.

**Consequence:** `[RequiredWhenCreating]` / `[RequiredWhenUpdating]` are now actually enforced —
previously only `[Required]` was. Callers that relied on the older permissive behavior may see new
validation failures.

### 2026-09-01T00:00:00Z: RequireOneWhenCreating is a group rule, and nested-model recursion is now optional-by-foreign-key

**By:** Backend (requested by Martin)

**Superseded in part:** the Create-mode recursion skip for nested models with a non-zero `Id`, and the
corresponding `CRUD.CreateModelProperties` reference branch, were reverted later the same day. See
"A child object at create time means 'create the child'" below for the rule that stands. The group-rule
mechanism itself (`RequireOneWhenCreatingGroups`, `HasProvidedValue`, registration-time binding) is
unchanged and still current.

**What:** `CrudGeneratorInfo` gained `RequireOneWhenCreatingGroups`, an `IReadOnlyList<RequireOneWhenCreatingGroup>`
built once in `CrudInfoGeneration.GenerateCrudInfo<T>`. The record binds the attribute's `FirstProperty` /
`SecondProperty` strings to `PropertyInfo` at registration time and caches the attribute's own formatted
message; an unresolvable name throws `InvalidOperationException` naming the model and property, so a typo
fails at service registration rather than silently disabling the rule.

`CrudValidator`'s recursion moved into a new `ValidateModel` driver that runs the existing per-property
`ValidateRequiredProperties` pass and, in `ValidationMode.Create` only, a new
`ValidateRequireOneWhenCreatingGroups` pass. Exactly one of the pair must be provided: neither reuses the
attribute's message, both is rejected with a dedicated "only one of" message.

Group membership uses a new `HasProvidedValue(PropertyInfo, object)` helper rather than the general
`HasValue(object?)`. It compares a value-type property against `default` of its declared (nullable-unwrapped)
type, so an unset foreign key id of `0` reads as "not provided". `HasValue` is unchanged for every other check.

`CRUD.CreateModelProperties` and `CRUD.FullModelUpdate` no longer throw on a null nested model when the
matching `{PropertyName}Id` is populated — they skip it and let the foreign key carry the link.

**Why:** `[RequireOneWhenCreating(nameof(JobPosting), nameof(JobPostingId))]` expresses a relationship between
two properties, which the per-property `RequiredPropertiesFor` helper cannot represent. Both-provided is an
error because `CreateModelProperties` always creates the nested object and `AssignModelProperties` then
overwrites the caller's id — accepting both would silently discard caller input. Comparing against `default`
rather than special-casing `int == 0` keeps the rule correct for `long`, `Nullable<int>`, and any future id type.

**Consequence:** Creating a record by passing an already-persisted nested object is no longer the supported
shape; pass the id instead. Tests that did so were updated. Foreign key integrity is enforced by the existing
`ai_prompt` constraints in migration `0005`, which are live because `Database.Connect()` already issues
`PRAGMA foreign_keys = ON` per connection.

**Risk:** On the update path a null nested model with a populated id now means "leave the existing link
alone" rather than throwing. A caller who intended a cascade update but forgot to attach the child gets a
silent no-op.

### 2026-09-01T00:00:00Z: A child object at create time means "create the child"; a foreign key id means "link to it"

**By:** Backend (requested by Martin)

**Supersedes:** `backend-reference-vs-create-semantics` and `backend-reference-form-strictness`. Both
described nested models with a non-zero `Id` as a *reference* to an existing row, permitted alongside a
matching foreign key id. That model is withdrawn in full. Neither decision had been merged into
`.squad/decisions.md`; this record replaces them wherever they are held. Their inbox drafts were deleted
unmerged by Scribe on 2026-09-01T00:00:00Z.

**What:** On the create path, exactly one of {child object, `{PropertyName}Id` foreign key} may be
provided, and a provided child object must be new — its `Id` must be unset.

| Nested object | Foreign key id | Verdict |
| --- | --- | --- |
| null | 0 | Error — neither provided |
| new object, `Id == 0` | 0 | Valid — create the child |
| null | 7 | Valid — link to existing row 7 |
| new object, `Id == 0` | 7 | Error — exactly one may be provided |
| object with `Id != 0` | anything | Error — a child object may not carry an `Id` |

`CrudValidator.ValidateRequireOneWhenCreatingGroups` implements the table. The two consistency messages
from the reference model ("...must reference the same record" and "...must also be set to [7]") are
deleted. The Create-mode recursion skip for nested models with a non-zero `Id` is reverted — a present
child object is always being created, so it is fully validated against its create-time required rules.
`CRUD.CreateModelProperties` no longer short-circuits a nested model with a non-zero `Id` into
`modelValues`; validation rejects that shape before the CRUD layer runs. The null-object-with-foreign-key
`continue` is unchanged: it remains the link path. `docs/CODING-STANDARDS.md` §"Create-path object graph
contract" was rewritten to match.

**Why:** The reference form gave the same JSON shape two meanings depending on a field the caller could
easily leave stale, and required a redundant id to be repeated in two places. Making a child object mean
one thing — create it — removes the ambiguity, removes the consistency checks entirely, and makes the
minimal correct payload obvious in both directions.

**Consequence:** Callers that passed a persisted child object alongside its foreign key id now fail
validation. Six create payloads in `tests/JobSearchAssistant.Server.Tests/ControllerCrudTests.cs` were
reduced to the foreign key id alone. `CRUD.CreateModel`'s `data.Id != 0` guard is retained: it is now
redundant for nested models, which validation rejects first with a more actionable message, but it is
the only guard against re-creating an already-persisted *root* model, which no group rule covers.

**Verification:** DB.Tests 54/54, Server.Tests 27/27, `dotnet build src/DB/DB.csproj` clean — run
independently by the coordinator, not self-reported.

**Open:** The update and patch paths still accept a persisted child object with a matching foreign key
id. Martin is handling that as a separate thread; this decision covers the create path only.

## Governance

- Meaningful architectural changes require Lead review and affected-team input
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
