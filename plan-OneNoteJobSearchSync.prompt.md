## Plan: OneNote Job Search Sync Spec v1

Build a Windows-first C# application with a shared sync engine and two front ends: command-line and desktop UI. Both surfaces execute the same core workflow: resolve OneNote page path, scope by header, filter paragraphs by style (starting with Heading 2), open an Excel file that is embedded in the page, and append rows to an Excel table with deterministic deduplication.

**Steps**
1. Phase 1 - Product Shape and Shared Architecture
2. Define app surfaces for v1:
- CLI mode for automation and scripting.
- UI mode for guided interactive use.
- Both modes call a single application service layer so behavior remains identical.
3. Define shared request contract used by both CLI and UI:
- OneNote path string (notebook > section group > section > page).
- Header text anchor.
- Paragraph style selector.
- Excel target settings.
- Execution options (dry-run, verbose, max rows, duplicate strategy).
4. Phase 2 - Input Contract and Resolution
5. Define CLI input mapping:
- path, header, style, workbook source, sheet, table, dry-run, verbose.
6. Define UI input mapping:
- Form fields mirroring CLI arguments, validation hints, and picker helpers for notebook path.
7. Build path resolver that:
- Parses >-delimited tokens with trim and escape handling.
- Resolves notebook -> section group -> section -> page with exact-match first, case-insensitive fallback.
- Returns ambiguity diagnostics with candidate list.
8. Phase 3 - OneNote Extraction Semantics
9. Load page content and structural metadata to identify:
- Heading blocks for header scoping.
- Paragraph style metadata (starting with Heading 2 support).
- Paragraph order and outline context.
10. Define header scoping rule:
- Start at first paragraph whose normalized text equals header.
- End before next heading at same or higher level.
- Fail with actionable error when header is not found.
11. Define paragraph filter rule:
- Include only paragraphs in scoped block where style equals requested style.
- Support canonical names (Heading 1..6, Normal) and alias map.
- Preserve source order, text, and stable fingerprint.
12. Phase 4 - Link Strategy and Record Model
13. Generate OneNote link payload per selected paragraph:
- Canonical page link required.
- Paragraph locator metadata (fingerprint plus local index) for best-effort deep targeting.
14. Define Excel row schema:
- CapturedAtUtc, NotebookPath, Header, ParagraphStyle, ParagraphText, PageLink, ParagraphLocator, SourceKey.
- SourceKey is deterministic hash of page identity plus scoped paragraph fingerprint.
15. Phase 5 - Excel Write Path
16. Support workbook source modes:
- Linked OneDrive or SharePoint workbook as primary.
- Local xlsx path as secondary.
- Embedded-in-OneNote workbook via documented fallback workflow only in v1.
17. Append rows to named table with schema validation:
- Verify table and required columns exist.
- Dry-run previews proposed rows.
- Default duplicate behavior is skip by SourceKey.
18. Phase 6 - UI and CLI Experience
19. CLI behavior:
- Human-readable summary plus machine-parseable exit codes.
- Optional JSON output for automation.
20. UI behavior:
- Input form, run button, progress state, results grid (matched, inserted, skipped), and exportable run log.
- Same validation/error taxonomy as CLI with user-friendly phrasing.
21. Phase 7 - Reliability and Verification
22. Add structured logging and failure taxonomy:
- PathNotFound, PathAmbiguous, HeaderNotFound, StyleUnsupported, TableMissing, AuthFailed, WorkbookUnavailable.
23. Build tests:
- Unit tests for path parsing/resolution, header scoping, style matching.
- Integration tests for one end-to-end dry-run and one write-run.
- Regression tests for dedupe correctness across repeated runs from both CLI and UI.

**Relevant files**
- /home/wsluser/dev/job-search-assistant/docs/specs/onenote-excel-sync-v1.md — full functional and technical spec.
- /home/wsluser/dev/job-search-assistant/src/core/sync-request.cs — shared request DTO used by CLI and UI.
- /home/wsluser/dev/job-search-assistant/src/core/sync-orchestrator.cs — single workflow coordinator invoked by both front ends.
- /home/wsluser/dev/job-search-assistant/src/cli/options.cs — CLI argument contract and validation.
- /home/wsluser/dev/job-search-assistant/src/cli/command-runner.cs — CLI adapter that maps args to shared request and renders results.
- /home/wsluser/dev/job-search-assistant/src/ui/app-shell.cs — UI bootstrap and dependency wiring.
- /home/wsluser/dev/job-search-assistant/src/ui/views/sync-form.cs — UI fields and validations for path, header, style, and Excel target.
- /home/wsluser/dev/job-search-assistant/src/ui/viewmodels/sync-run-viewmodel.cs — UI state, progress, and result projection.
- /home/wsluser/dev/job-search-assistant/src/onenote/path-resolver.cs — hierarchical path resolution logic.
- /home/wsluser/dev/job-search-assistant/src/onenote/page-scoper.cs — header scope boundary detection.
- /home/wsluser/dev/job-search-assistant/src/onenote/paragraph-filter.cs — style filter and fingerprint generation.
- /home/wsluser/dev/job-search-assistant/src/excel/table-writer.cs — schema validation, dedupe check, and append.
- /home/wsluser/dev/job-search-assistant/src/core/source-key.cs — deterministic dedupe key generation.
- /home/wsluser/dev/job-search-assistant/docs/limitations.md — OneNote deep-link and embedded workbook constraints.

**Verification**
1. Unit: path tokenizer supports bracketed tokens and whitespace normalization.
2. Unit: header scoping boundaries across nested and sibling headings.
3. Unit: style matcher for Heading 2 aliases and canonical mapping.
4. Integration CLI: dry-run and write-run on representative data.
5. Integration UI: same scenario as CLI and equivalent output counts.
6. Regression: repeat runs from both surfaces skip duplicates via SourceKey.

**Decisions**
- Included scope:
- Dual interface delivery (CLI plus UI) with one shared execution engine.
- Path-driven page targeting by notebook > section group > section > page.
- Header-scoped processing anchored at user-provided heading.
- Style-based paragraph selection beginning with Heading 2.
- Deterministic Excel inserts with duplicate suppression.
- Excluded from v1:
- Guaranteed paragraph deep-link anchors in OneNote.
- Fully automated extraction of true embedded OLE Excel objects.
- Assumptions:
- Windows environment and C# runtime are acceptable.
- Target pages use consistent heading conventions under selected header.

**Further Considerations**
1. UI toolkit choice recommendation: WPF for native Windows simplicity, or WinUI 3 for newer shell and deployment path.
2. Future selector expansion recommendation: add regex text and indentation predicates after style-first v1 stabilizes.
3. Future write-mode recommendation: optional upsert when paragraph text changes but SourceKey is stable.