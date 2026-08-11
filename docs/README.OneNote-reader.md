
# How does the tool know which notebook to open? Or does it use the currently open notebook?

The tool uses the OneNote COM API (OneNote.Application), which has its own registry of every notebook OneNote knows about on the machine — not just what's currently visible in the OneNote window.

Here's what happens step by step:

**GetHierarchy** is called with scope hsPages, which returns an XML dump of all notebooks OneNote has ever opened/synced on this machine — regardless of whether OneNote is currently open or which notebook is "active"
**PathResolver** walks that XML tree matching your --path tokens against notebook → section → page names
Once the page ID is found, GetPageContent fetches the page XML by ID

Practical implications for you:
* OneNote doesn't need to be open, but it must be installed — the COM object (OneNote.Application) will auto-start in the background if it isn't running
* The notebook name in --path should match what OneNote calls it (shown in the OneNote left panel), not the folder name — they're usually the same but can differ

# How do I know what notebooks I can use?

```cmd
dotnet run --project src/JobSearchAssistant.Cli -- list-notebooks
```

# Local COM smoke test (resolve + fetch page XML)

Use this when you want to verify that the local OneNote desktop COM integration can:

1. Resolve a page path from the machine's local OneNote hierarchy
2. Fetch the page XML through `GetPageContent`
3. Return a small text preview from that XML

Command:

```cmd
dotnet run --project src/JobSearchAssistant.Cli -- local-smoke --path "Notebook > Section > Page"
```

Path examples:

* `Notebook > Section > Page`
* `Notebook > SectionGroup > Section > Page`
* `Notebook > Group A > Group B > Section > Page`

Expected result on success:

* Prints the resolved page title and page ID
* Prints the local OneNote hyperlink when available
* Prints raw XML byte count
* Prints a short text preview extracted from the page XML

# Troubleshooting: TYPE_E_LIBNOTREGISTERED (0x8002801D)

If you see this error:

```text
[ERROR] Library not registered. (0x8002801D (TYPE_E_LIBNOTREGISTERED))
```

OneNote is installed, but its COM type library registration is broken.

Try this sequence:

1. Close OneNote and other Office apps.
2. Re-register OneNote COM from an elevated shell.

   **Note:** Run as administrator.

   PowerShell:
   ```powershell
   Stop-Process -Name ONENOTE -Force -ErrorAction SilentlyContinue
   ```
   Note: Stopping OneNote with this command allowed the /regserver command below to work correctly and move past the `(0x8002801D (TYPE_E_LIBNOTREGISTERED))` error.

   ```powershell
   & "C:\Program Files\Microsoft Office\Root\Office16\ONENOTE.EXE" /regserver
   ```

3. Run the command again:

   ```cmd
   dotnet run --project src/JobSearchAssistant.Cli -- list-notebooks
   ```

4. If it still fails, run Office Quick Repair, reboot, and retry.

   4.1 The safest next PowerShell commands are to open the built-in repair UI:
   ```powershell
   Start-Process "ms-settings:appsfeatures"
   ```

   4.2 If that URI does not open the right place, use:
   ```powershell
   Start-Process appwiz.cpl
   ```

   4.3 Then repair:
   
   `Microsoft Office LTSC Professional Plus 2024 - en-us`

   4.4 If the COM error still persists after running `Quick Repair`, run `Online Repair`

5. If Quick Repair does not fix it, run Office Online Repair (full repair), reboot, and retry.

6. If you are on Office LTSC and it still fails, ask IT to reinstall/modify OneNote desktop from the Office deployment so COM registration is rebuilt.

Notes for Office LTSC:

* This error can persist even after /regserver when the OneNote COM TypeLib registry entry is missing.
* In that case, only Office repair/reinstall typically restores the missing COM registration.

# Graph fallback smoke test (auth + open page)

If COM is unavailable, you can validate Microsoft Graph access with a minimal command that:

1. Authenticates with device-code sign-in
2. Resolves a path in the form `Notebook > [SectionGroup > ... >] Section > Page`
3. Fetches that page's content stream

Prerequisites:

* Either:
  * Azure CLI signed in (`az login`), or
  * A Microsoft Entra app registration configured as a public client
* Delegated permissions: `User.Read` and `Notes.Read`

Command:

```cmd
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --path "Notebook > Section > Page"
```

Path examples:

* `Notebook > Section > Page`
* `Notebook > SectionGroup > Section > Page`
* `Notebook > Group A > Group B > Section > Page`

List available names first (recommended):

```cmd
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --list
```

List details for one notebook (default detailed mode):

```cmd
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --list-sections --notebook "Notebook Name"
```

List detailed sections/groups for all notebooks (slow):

```cmd
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --list-sections --all-notebooks
```

Optional device-code fallback (explicit client ID):

```cmd
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id <APP_CLIENT_ID> --tenant-id <TENANT_ID_OR_DOMAIN> --path "Notebook > Section > Page"
```

Content fetch behavior:

* By default, `graph-smoke` succeeds if notebook/section/page resolution succeeds, even when Graph content stream retrieval fails with a transient/opaque OneNote error.
* Use `--strict-content` to require successful content stream retrieval and fail otherwise.
* Use `--content-mode full` for full page HTML (default), `--content-mode preview` for the smaller `/pages/{id}/preview` payload, or `--content-mode none` to skip page payload retrieval entirely.
* `--content-mode preview` is useful when page resolution succeeds but `/content` fails with a transient OneNote 500.

Tenant note:

* If your app registration is configured for Microsoft personal accounts only, use `--tenant-id consumers` (not a tenant GUID).

Sign-in persistence:

* Azure CLI mode: run `az login` once and reuse that session until it expires/signs out.
* Device-code mode (`--client-id`): tokens plus authentication record are cached locally by the CLI.
  * First run prompts for device code.
  * Later runs should usually authenticate silently until policy/token expiry requires re-auth.
  * Cache path: `%LOCALAPPDATA%\\JobSearchAssistant\\Auth`
  * If you were testing older builds and still see repeated prompts, delete `%LOCALAPPDATA%\\JobSearchAssistant\\Auth` once, then sign in again.
  ```
  if (Test-Path "$env:LOCALAPPDATA\JobSearchAssistant\Auth") { Remove-Item -Recurse -Force "$env:LOCALAPPDATA\JobSearchAssistant\Auth" }
  ```

Example:

```cmd
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id 11111111-2222-3333-4444-555555555555 --tenant-id contoso.onmicrosoft.com --path "Job Search > Pipeline > Applications"
```

Expected result on success:

* Prints authenticated user identity
* Prints matched notebook/section/page IDs
* Prints OneNote web URL
* Prints non-zero "Content bytes fetched"



# Okay. Let's try it. Start with the bare minimum to verify that we can authenticate and open the file

Implemented the bare-minimum Graph smoke path so you can verify auth plus page access before building full sync.

What I changed

Added a new CLI command graph-smoke in GraphSmokeCommand.cs.
Wired it into startup in Program.cs.
Added Graph/auth dependencies in JobSearchAssistant.Cli.csproj.
Documented usage in README.md.
What graph-smoke does

Authenticates to Microsoft Graph.
Calls /me to prove sign-in works.
Resolves path as Notebook > Section > Page.
Fetches the page content stream and prints content byte count.
Auth behavior

If no client ID is supplied, it tries Azure CLI credential first.
If a client ID is supplied, it uses a chained auth path: Azure CLI, then device-code fallback.
Validation results from this machine

Build passes.
Command wiring works.
Runtime reached auth, then failed because Azure CLI is not installed in this environment.

## How to run on your machine

### Azure CLI route (simplest)

1. Install Azure CLI if needed.
2. Run az login.
3. Run:
```
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --path "Notebook > Section > Page"
```

### Device-code route (no Azure CLI required)

1. Create/use an Entra public client app with delegated permissions User.Read and Notes.Read.
2. Run:
```
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id YOUR_APP_CLIENT_ID --tenant-id YOUR_TENANT_OR_DOMAIN --path "Notebook > Section > Page"
```

If the app is Microsoft-account-only, use `--tenant-id consumers`:
```
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id YOUR_APP_CLIENT_ID --tenant-id consumers --path "Notebook > Section > Page"
```

dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id <APP_CLIENT_ID> --tenant-id <TENANT_ID_OR_DOMAIN> --path "Notebook > Section > Page"

dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id <APP_CLIENT_ID> --tenant-id <TENANT_ID_OR_DOMAIN> --path "Notebook > Section > Page"

#### Smoke test online notebook access
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id <APP_CLIENT_ID> --tenant-id consumers --path "Notebook > Section > Page"

#### Smoke test with smaller page preview payload
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id <APP_CLIENT_ID> --tenant-id consumers --content-mode preview --path "Notebook > Section > Page"

#### Require payload fetch success
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id <APP_CLIENT_ID> --tenant-id consumers --strict-content --path "Notebook > Section > Page"

#### List available online notebooks
##### This lists notebook names only.
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --list --client-id <APP_CLIENT_ID> --tenant-id consumers
##### Detailed view for one notebook (default detailed target):
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --list-sections --notebook "Notebook Name" --client-id <APP_CLIENT_ID> --tenant-id consumers
##### Detailed view for all notebooks (explicit, slower):
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --list-sections --all-notebooks --client-id <APP_CLIENT_ID> --tenant-id consumers
##### Page lookup remains:
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id <APP_CLIENT_ID> --tenant-id consumers --path "Notebook > Section > Page"

#### List details for one online notebook
dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --list-sections --notebook "Notebook Name" --client-id <APP_CLIENT_ID> --tenant-id consumers

dotnet run --project src/JobSearchAssistant.Cli -- graph-smoke --client-id <APP_CLIENT_ID> --tenant-id consumers --path "Notebook > Section > Page"
