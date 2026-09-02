# Project Context

- **Owner:** Martin
- **Project:** job-search-assistant
- **Stack:** React, TypeScript, C# .NET API, SQLite synchronized through OneDrive, Edge extension, MAUI
- **Created:** 2026-09-01T04:49:04.029Z

## Learnings

- The web UI is the primary product surface.
- The product captures postings, compares them with resumes, and supports AI-assisted resume tailoring.

## Team Updates

📌 Team update (2026-09-01T00:00:00Z): CREATE CONTRACT CHANGED. Posting a nested object AND its
`{PropertyName}Id` together is now a validation error — exactly one of the pair must be provided. Pass the
id when the related record already exists; pass the object only when it should be created. Any Web.Ui
request payload that sends both needs a sweep. — decided by Backend
