# Job Search Assistant

This project is a tool to help with searching for a job.

See [/docs/README.md](/docs/README.md) for more detailed information.

## Quick Start

### API Server

The API Server can be launched from the repo's root directory, run:

```powershell
& .vscode\start-server.ps1
```

### The web UI server

I’ll check the app’s actual frontend setup so I can give you the exact command to run the Web UI in this repo.

Read

## Run the Web UI

This app is a Vite frontend, and the dev server is defined in `./src/Web.Ui/package.json`.

From the repo root, run:

```powershell
pnpm install
pnpm --dir src/Web.Ui dev --host
```

Or, equivalently:

```powershell
cd ./src/Web.Ui
pnpm dev --host
```

Then open:

```text
http://localhost:5173/
```

> If port 5173 is already in use, Vite will usually print the next available port to use.

For a production build instead:

```powershell
cd c:\dev\job-search-assistant\src\Web.Ui
pnpm build
```

Then preview it with:

```powershell
pnpm preview --host
```

## Running tests

Run the SQLite migration and database tests from the repository root:

```bash
dotnet test tests/JobSearchAssistant.DB.Tests/JobSearchAssistant.DB.Tests.csproj --nologo --logger "console;verbosity=minimal"
```
