# Project Context

- **Owner:** Martin
- **Project:** job-search-assistant
- **Stack:** C# .NET API, SQLite synchronized through OneDrive, React, TypeScript, Edge extension, MAUI
- **Created:** 2026-09-01T04:49:04.029Z

## Learnings

- SQLite is a local file synchronized through OneDrive.
- Resume and job-posting workflows must preserve related records transactionally.
- `CrudValidator` is the single validation entry point for the CRUD layer; Create/Update/Patch differ
  only by the internal `ValidationMode` passed into one shared traversal. Add new rules there, not in
  `CRUD.cs`.

## Team Updates

📌 Team update (2026-08-31T00:00:00Z): CRUD validation unified behind a `ValidationMode`-parameterized
pipeline; duplicated private validators removed from `CRUD.cs` and `GetCrudInfo<T>()` fallback fixed to
include `required` members. Open follow-ups: `ValidatePartial` patch-value type checking, a public
`ValidationMode` overload for Server-layer pre-validation, `CrudValidatorTests` coverage, `AiPrompt.cs`
CS8618 warnings, and `ValidationResult` member naming. — decided by Backend

📌 Team update (2026-09-01T00:00:00Z): `[RequireOneWhenCreating]` is now enforced as a group rule.
`CrudGeneratorInfo.RequireOneWhenCreatingGroups` resolves the attribute's property-name strings to
`PropertyInfo` at registration — a typo throws `InvalidOperationException` at service registration, not
silently. The check runs in `ValidationMode.Create` only, via the new `ValidateModel` driver. Group
membership uses `HasProvidedValue(PropertyInfo, object)`, which compares against `default` of the declared
(nullable-unwrapped) type so an unset FK id of `0` reads as "not provided"; `HasValue` is unchanged.
BOTH-provided is an error because `CreateModelProperties` would otherwise discard the caller's id.
`CreateModelProperties` and `FullModelUpdate` now skip a null nested model when the FK id is populated.
RISK: on the update path that means "leave the existing link alone" instead of throwing — an intended
cascade update with a missing child is a silent no-op. Build UNVERIFIED (no terminal; no `dotnet build`
or `dotnet test`). Follow-ups: consumer sweep for DTOs posting an object alongside its id, no Update/Patch
equivalent of the attribute, `ModelWithDocument.Document` pairing still open. — decided by Backend

📌 Team update (2026-09-01T00:00:00Z): REVISION of the above — Martin rejected "both-provided is an error"
as too blunt. `ValidateRequireOneWhenCreatingGroups` now rejects only DISAGREEMENT: when both the nested
model and its `{Name}Id` are provided, `nested.Id` must equal the FK id, else an error naming both values.
The "Only one of [X] or [Y]" message is deleted. Neither-provided still uses the attribute's own message.
`CreateModelProperties` now treats any nested model with `Id != 0` as a REFERENCE — it goes into the
`modelValues` dictionary without recursing into `CreateModel`, so it never reaches the `data.Id != 0`
guard (which now only fires for the root). `AssignModelProperties` was already backfilling `{Name}Id` from
the child's `Id` for every dictionary entry, so referenced and created children share one backfill path and
it happens exactly once. Tests: replaced `AiPrompts_Create_WithBothObjectAndId_FailsValidation` with four
tests covering the consistent, object-only-backfill, contradictory-ids, and new-object-plus-id rows.
Build UNVERIFIED again — no `run_in_terminal` / `run_task` tool in this session; `get_task_output` returned
empty and cannot start a task. OPEN QUESTION for Martin: a referenced child is still validated in Create
mode, so an id-only reference object fails its own `[Required]` fields. — decided by Backend

📌 Team update (2026-09-01T00:00:00Z): Server test suite reconciled — 27/27 passing, DB suite still 54/54.
All five failures were STALE FIXTURES, not defects in the validation work. (A) `JobPostings_CreateRoute`
omitted `url`; `[Required]` on `JobPosting.Title/Company/Location/Salary/Url/WorkModel` is part of THIS
uncommitted change set (`git diff src/DB/Models/JobPosting.cs` shows the attributes and the
`System.ComponentModel.DataAnnotations` using being added) — the committed baseline had no attributes at
all, so the payload previously inserted `url = ''` into a `not null` column and passed. Premise that
`[Required]` predated the work was wrong. (B/C/D) `AiPrompts_Controller_Tests.CreateDependenciesAsync`
constructed `promptDocument` / `responseDocument` with `new Document { ... }` and never persisted them, so
both `.Id` values were 0 and `HasProvidedValue` correctly read them as not-provided; fixed by routing both
through `DB.Services.Documents().Create`. (E) `AiPrompts_CreateRoute` 200-vs-201 was NOT a result-shape
problem — `Assert.IsType<CreatedAtRoute<AiPrompt>>(result)` passed; the test asserted
`context.Response.StatusCode` while `await result.ExecuteAsync(context)` sat commented out, so it read the
`DefaultHttpContext` default of 200. Both route tests now assert `responsePayload.StatusCode`, which is the
value actually under test; `ExecuteAsync` is not viable here because `CreatedAtRoute` needs a
`LinkGenerator` with the named endpoint registered, and the fixture only calls `AddRouting()`. No
validation rule was weakened and no production behavior changed. StyleCop: SA1313 x3 fixed by converting
`RequireOneWhenCreatingGroup` from a positional record to `required internal { get; init; }` properties
(matches `CrudGeneratorInfo`); SA1202 x2 fixed by moving `ResolveGroupProperty` below `GetModelProperties`
and `HasProvidedValue` above the private members of `CrudValidator`. Pre-existing SA1005/SA1512 on the old
commented-out blocks left alone. VERIFIED: `dotnet build src/DB/DB.csproj` succeeded (12 warnings, 0
errors, no SA1313/SA1202); `dotnet test tests/JobSearchAssistant.DB.Tests` 54 passed / 0 failed;
`dotnet test tests/JobSearchAssistant.Server.Tests` 27 passed / 0 failed. No new contract decision emerged
— no decisions inbox entry written. — decided by Backend

📌 Team update (2026-09-01T00:00:00Z): The create-path contract is settled and merged to
`.squad/decisions.md`. **A child model object at create time means CREATE the child; to link an
existing child, send the FK id and omit the object.** An object carrying `Id != 0` is always an
error. Passes 1–2 of this session (the "reference" model, the both-provided consistency check, the
Create-mode recursion skip, the `CreateModelProperties` reference branch) are withdrawn — do not
reintroduce them. The group-rule mechanism from pass 1 stands. Update and patch paths still accept a
persisted child alongside a matching FK id; Martin owns that thread separately.

**Process learning — read this before the next pass.** Four passes shipped unverified because no
execution tool existed; five test failures stayed latent across all four and each pass built on the
previous pass's unchecked assumption. Martin has since added `execute/*` tools to
`.github/agents/squad.agent.md` frontmatter. Running the build and both suites is now part of the
work, not a follow-up. Also: verify whether an attribute or constraint is in the *committed baseline*
before reasoning about "previous behavior" — the `[Required]` attributes on `JobPosting` were part of
this uncommitted change set, which is what made Failure A confusing. — recorded by Scribe

📌 Team update (2026-09-02T00:00:00Z): Implemented convention-based IdsMustMatchGroup validation for Update/Patch per Lead's design; removed dead IdsMustMatchIfBothPresentWhenUpdatingAttribute; 5 new tests, DB.Tests 65/65 and Server.Tests 27/27 passing; docs/CODING-STANDARDS.md updated — decided by Backend.
