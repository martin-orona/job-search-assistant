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

### 2026-09-02: Update/Patch child-object-vs-foreign-key consistency check should be convention-based, not attribute-based

**By:** Lead (requested by Martin)

**What:** The gap identified in the 2026-09-01 "RequireOneWhenCreating is a group rule" decision's
"Open" note — Update/Patch accepting a nested child object *and* a matching `{Name}Id` foreign key with
no check that they agree — should be closed by deriving the pairing automatically at CRUD registration
time from `CrudGeneratorInfo.ModelProperties` plus a `{PropertyName}Id` naming convention, not by the
`IdsMustMatchIfBothPresentWhenUpdatingAttribute` Martin already added to `ValidationError.cs` and applied
to `Document`/`JobPosting`/`Resume`/`AiPromptTemplate`/`PromptDocument`/`ResponseDocument` in
[Model.cs](../../src/DB/Models/Model.cs) and [AiPrompt.cs](../../src/DB/Models/AiPrompt.cs).

Sketch of the registration-time resolution (mirrors `GetRequireOneWhenCreatingGroups<T>()`, does not
require an attribute lookup):

```csharp
internal static IReadOnlyList<IdsMustMatchGroup> GetIdsMustMatchGroups<T>()
{
    var modelType = typeof(T);
    var groups = new List<IdsMustMatchGroup>();

    foreach (var modelProperty in GetModelProperties<T>())
    {
        var idProperty = modelType.GetProperty($"{modelProperty.Name}Id", BindingFlags.Public | BindingFlags.Instance);
        if (idProperty is null)
        {
            continue; // no {Name}Id sibling -> nothing to reconcile, not an error
        }

        groups.Add(new IdsMustMatchGroup { Model = modelProperty, Id = idProperty });
    }

    return groups.AsReadOnly();
}
```

`ValidateModel` gains an unconditional (Update and Patch) pass, `ValidateIdsMustMatchGroups`, run
alongside `ValidateRequireOneWhenCreatingGroups`: for each group, if both `group.Model` (non-null, any
`Id`) and `group.Id` (`HasProvidedValue`) are present and `((Model)group.Model.GetValue(data)).Id !=
group.Id.GetValue(data)`, add one `ValidationError`. `IdsMustMatchIfBothPresentWhenUpdatingAttribute`
should be deleted from `ValidationError.cs` and its usages removed from `Model.cs` / `AiPrompt.cs` —
dead metadata that enforces nothing should not stay in the model files once the real check exists
elsewhere, or the next reader will assume it's load-bearing.

**Why:** Verified against every current `Model`-typed property across `Document`, `JobPosting`,
`Resume`, `AiPrompt`, and `AiPromptTemplate` — a `{PropertyName}Id` sibling exists in 100% of cases
today, so the naming convention already holds with zero exceptions and needs no opt-out mechanism yet.
An attribute-based check has the exact "forgotten annotation → silently unchecked" failure mode Martin
flagged, and the codebase already has one live instance of that risk in `[RequireOneWhenCreating]`
(mitigated there only by `ResolveGroupProperty` throwing on a *misspelled* name, not on a missing
attribute). Convention-based derivation from `ModelProperties` — which `CrudGeneratorInfo` already
computes for every model via reflection, not developer opt-in — applies the check to every nested model
property unconditionally; a developer adding a new `Document`-typed property to a model gets the check
for free as long as they follow the `{Name}Id` naming convention the codebase already uses everywhere.
The absence of a same-named `Id` property is not an error case to guard against: `GetModelProperties<T>`
already recurses into every nested model regardless of whether an `Id` sibling exists, so "no sibling
found" naturally means "nothing to reconcile," not "developer forgot something."

**Consequence:** No attribute needed on new model properties for this rule to apply; the convention
becomes a documented codebase invariant (record in `docs/CODING-STANDARDS.md`) rather than a per-property
opt-in. If a future property genuinely needs a `Model`-typed field with no matching foreign key column
(the convention breaking), the resolver's `continue` on a missing `{Name}Id` property already acts as
the opt-out — no attribute or exception list required. This is an analysis/recommendation only; Backend
should implement `GetIdsMustMatchGroups<T>`, wire it into `CrudGeneratorInfo` and `ValidateModel`, remove
the dead attribute, and add coverage in `ControllerCrudTests.cs` for the both-present-but-mismatched
Update/Patch case.

**Open:** Whether `ValidateIdsMustMatchGroups` should also run on Patch when only one of the two keys is
present in the patch dictionary (e.g., patch supplies `document.id` but not `documentId`, and the
existing persisted `documentId` differs) — that requires comparing against the *persisted* row, not just
the patch payload, which `ValidatePatchFields`'s current shape doesn't support. Left for Backend to
resolve during implementation; flagging so it isn't missed.

### 2026-09-02: Update/Patch child-object-vs-foreign-key consistency check implemented convention-based, per Lead's design

**By:** Backend (requested by Martin)

**What:** Implemented Lead's convention-based recommendation (see preceding decision) closing the
Update/Patch gap flagged in the 2026-09-01 "RequireOneWhenCreating is a group rule" decision.
`CrudInfoGeneration.GetIdsMustMatchGroups<T>()` derives a resolved `IdsMustMatchGroup { Model, ForeignKeyId }`
pairing for every `Model`-typed property already collected by `GetModelProperties<T>()`, by looking for a
sibling `{PropertyName}Id` property via reflection — mirroring `GetRequireOneWhenCreatingGroups<T>()` but
with zero attribute involvement. A missing `{PropertyName}Id` sibling is the natural opt-out (`continue`,
no error). The groups are stored on `CrudGeneratorInfo.IdsMustMatchGroups` and populated in both
`GenerateCrudInfo<T>` and the empty fallback in `GetCrudInfo<T>`.

`CrudValidator.ValidateModel` now runs `ValidateIdsMustMatchGroups` for the `else` branch (Update; Create
already forbids providing both, so it keeps running only `ValidateRequireOneWhenCreatingGroups`). For
Patch — which never reaches `ValidateModel` since patch payloads are `Dictionary<string, object?>`, not
typed `Model` instances — the equivalent check lives in `ValidatePatchFields` as
`ValidatePatchIdsMustMatchGroups`, reading both sides (the nested object's `"id"` and the sibling
`{Name}Id` scalar) back out of the same patch dictionary, tolerant of both `JsonElement` (HTTP path) and
plain CLR values (direct in-process calls). Both checks only fire when *both* sides are present in the
same request/dictionary; a single side present is the already-covered link/leave-untouched case and is a
no-op here.

Removed the dead `IdsMustMatchIfBothPresentWhenUpdatingAttribute` from
[ValidationError.cs](../../src/Core/Validation/ValidationError.cs) and its `[IdsMustMatchIfBothPresentWhenUpdating(...)]`
usages from [Model.cs](../../src/DB/Models/Model.cs) (`ModelWithDocument.Document`) and
[AiPrompt.cs](../../src/DB/Models/AiPrompt.cs) (`JobPosting`, `Resume`, `AiPromptTemplate`,
`PromptDocument`, `ResponseDocument`) — grepped the whole `src/DB/Models` directory first; no other
usages existed.

**Why:** An attribute-based check has the "forgotten annotation → silently unchecked" failure mode Martin
originally flagged, and the attribute Backend had added enforced nothing (metadata only, no validator ever
read it). Deriving the pairing from `ModelProperties`/`{PropertyName}Id` — data `CrudGeneratorInfo` already
computes for every model via reflection — makes the check apply automatically to every current and future
nested model property that follows the naming convention, with no per-property developer action required.

**Consequence:** Adding a new `Model`-typed property with a matching `{PropertyName}Id` sibling gets this
consistency check for free. A property that intentionally has no `{PropertyName}Id` sibling is automatically
exempt — no attribute or exception list needed. Documented as a codebase invariant in
`docs/CODING-STANDARDS.md` under "Nested model / foreign key id agreement (update and patch)".

**Tests:** Added `tests/JobSearchAssistant.DB.Tests/Services/IdsMustMatchGroupValidationTests.cs` (5 tests):
Update with matching ids passes, Update with mismatched ids fails with a clear error, Update with only the
foreign key id provided passes, Patch with matching ids passes, Patch with mismatched ids fails. Full DB
test project run: 65/65 passed. Server test project run (regression check after attribute removal): 27/27
passed.

## Governance

- Meaningful architectural changes require Lead review and affected-team input
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
