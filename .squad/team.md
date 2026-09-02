# Squad Team

> job-search-assistant

## Coordinator

| Name | Role | Notes |
|------|------|-------|
| Squad | Coordinator | Routes work, enforces handoffs and reviewer gates. |

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Lead | Technical Lead | `.squad/agents/lead/charter.md` | 🏗️ Active |
| Frontend | Frontend Dev | `.squad/agents/frontend/charter.md` | ⚛️ Active |
| Backend | Backend Dev | `.squad/agents/backend/charter.md` | 🔧 Active |
| Extension | Browser Extension Dev | `.squad/agents/extension/charter.md` | ⚛️ Active |
| Tester | QA | `.squad/agents/tester/charter.md` | 🧪 Active |
| Scribe | Memory, Decisions, Session Logs | `.squad/agents/scribe/charter.md` | 📋 Silent |
| Ralph | Backlog and Work Monitor | `.squad/agents/ralph/charter.md` | 🔄 Monitor |
| Rai | RAI and Content-Safety Review | `.squad/agents/Rai/charter.md` | 🛡️ Background |
| Fact Checker | Verification and Devil's-Advocate Review | `.squad/agents/fact-checker/charter.md` | 🔍 Background |

## Project Context

- **Project:** job-search-assistant
- **Owner:** Martin
- **Stack:** C# .NET lightweight API, SQLite, OneDrive sync, React, TypeScript, Edge browser extension, MAUI desktop UI
- **Description:** Captures job postings, compares them with resumes, helps tailor resumes with AI, and will support application tracking and search-effort reporting.
- **Architecture:** SQLite is a local file synchronized through OneDrive; React and TypeScript are the primary UI; the Edge extension captures jobs because Indeed cannot load in an iframe; MAUI is a secondary desktop UI.
- **Created:** 2026-09-01T04:49:04.029Z
