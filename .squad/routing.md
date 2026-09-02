# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Scope, architecture, cross-system design, code review | Lead | Feature decomposition, API/UI contracts, reviewer gates |
| React, TypeScript, and web UX | Frontend | Web UI components, state flows, accessibility, styling |
| .NET API, SQLite, and OneDrive synchronization | Backend | Endpoints, persistence, sync workflows, server integration |
| Edge automation and job capture | Extension | Manifest, content scripts, background scripts, Indeed capture |
| Integration tests and workflow coverage | Tester | End-to-end scenarios, regression coverage, test failures |
| Memory, decisions, and session logs | Scribe | Decision inbox, orchestration logs, cross-agent context |
| Backlog monitoring and issue pickup | Ralph | Actionable issue scan, status tracking, blocked-work escalation |
| RAI and content-safety review | Rai | Privacy, credentials, harmful content, AI safety review |
| Claim verification and design challenge | fact-checker | External claims, package checks, pre-mortems, devil's advocate |

Preset installation adds concrete routes for the configured team. Add or edit rows
here only when their agent names also exist in the casting registry.

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign `squad:{member}` label | Lead |
| `squad:{name}` | Pick up issue and complete the work | Named member |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, the **Lead** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

## Rules

1. **Eager by default** — spawn all agents who could usefully start work, including anticipatory downstream work.
2. **Scribe always runs** after substantial work, always as `mode: "background"`. Never blocks.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → fan-out.** Spawn all relevant agents in parallel as `mode: "background"`.
6. **Anticipate downstream work.** If a feature is being built, spawn the tester to write test cases from requirements simultaneously.
7. **Issue-labeled work** — when a `squad:{member}` label is applied to an issue, route to that member. The Lead handles all `squad` (base label) triage.
8. **Cross-surface work** — Lead coordinates changes spanning the API, web UI, extension, SQLite sync, or MAUI desktop UI; Tester starts workflow coverage in parallel.
9. **Privacy-sensitive work** — include Rai when handling resumes, job postings, application data, AI prompts, or OneDrive synchronization.
10. **External claims and vendor behavior** — include Fact Checker before publishing assertions about AI services, browser APIs, job sites, packages, or sync behavior.
