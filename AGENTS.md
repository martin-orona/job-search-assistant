# AI Development Instructions

Before changing this repository, read and follow the project standards in
[docs/CODING-STANDARDS.md](docs/CODING-STANDARDS.md).

The standards document defines the required coding conventions, architecture
patterns, persistence rules, testing expectations, and documentation practices
for this project.

## Critical test rule for AI agents

When writing or fixing UI and end-to-end tests, do not assert against unrelated
async state changes or transient status updates. A test must wait for the exact
browser event, network response, or DOM condition that proves the behavior under
test. Do not write assertions that race against mount-time refreshes,
animations, or background updates that can overwrite the same UI element.

If a status message is transient, assert the lifecycle or the correct post-action
state after the relevant user flow, not the stale message that appears from an
unrelated refresh.

## Transactional delete rule for AI agents

Do not coordinate multi-step delete workflows in the UI when a single user action
can remove several related records and then fail on a later step. That pattern
creates partial database deletes and leaves the application in an inconsistent
state.

Instead, implement the delete as a single server-side workflow that runs in one
transaction. The server must determine the cascade set, delete the affected rows
atomically, and return a clear failure message naming the entities or records
that blocked the operation when a foreign-key or validation error occurs.

If the operation fails in the middle of a multi-entity delete, the database must
remain unchanged. The UI should only surface the server's result and error
details, not perform its own sequence of delete calls across multiple records.

## Focused debugging rule for AI agents

When a browser or end-to-end regression is failing, do not keep broadening the
search with ad hoc command-line repros or speculative code edits. First isolate
one real failing scenario in the same spec file as a focused sibling test, or a
single exact test filter if the project already organizes cases that way. Verify
that the narrowed scenario fails for the right reason, fix the root cause, and
only then re-run the related group.

This keeps the debugging loop small, observable, and reproducible. It avoids
long periods of churn where the agent is testing many nearby variants without a
clear signal about what actually broke.
