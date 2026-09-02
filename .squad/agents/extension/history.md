# Project Context

- **Owner:** Martin
- **Project:** job-search-assistant
- **Stack:** Edge extension, React, TypeScript, C# .NET API, SQLite synchronized through OneDrive, MAUI
- **Created:** 2026-09-01T04:49:04.029Z

## Learnings

- The Edge extension owns job capture and automation.
- Indeed cannot load in an iframe, so capture must run in the browser context.

## Team Updates

📌 Team update (2026-09-01T00:00:00Z): CREATE CONTRACT CHANGED. Posting a nested object AND its
`{PropertyName}Id` together is now a validation error — exactly one of the pair must be provided. Capture
payloads that send an already-persisted related record alongside its id need a sweep; send the id instead.
— decided by Backend
