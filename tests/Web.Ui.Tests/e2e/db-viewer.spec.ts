import { expect, Locator, Page, test, TestInfo } from "@playwright/test";
import { callServer, cleanupDbViewerTestFlow, getTestHeaders, initiateDbViewerTestFlow, resetPersistedUiState } from "./helpers";

namespace DbViewer {
  test.describe("Feature: DB Viewer", () => {
    test.beforeEach(async ({ page, context, browser, request }, testInfo) => {
      console.log("Setting up for test:", testInfo.title, testInfo.testId);
      await resetPersistedUiState(page);
      await initiateDbViewerTestFlow(page, testInfo);
      await cleanupDbViewerTestFlow(page, testInfo);
    });

    test.afterEach(async ({ page }, testInfo) => {
      await cleanupDbViewerTestFlow(page, testInfo);
      await resetPersistedUiState(page);
    });

    const seedRecords: Record<string, EntitySeedDictionary> = {
      "job-postings": {
        primary: {
          name: "Job Posting",
          route: "job-postings",
          data: {
            title: "Senior Engineer",
            company: "Contoso",
            location: "Remote",
            salary: "$150,000",
            workModel: "Remote",
            url: "https://example.com/job/7",
            document: {
              title: "Senior Engineer",
              type: "markdown",
              content: "# Senior Engineer",
              source: "https://example.com/job/7",
            },
          },
        },
      },
      resumes: {
        primary: {
          name: "Resume",
          route: "resumes",
          data: {
            name: "Senior Resume",
            jobTitle: "Principal Engineer",
            date: "2026-01-15",
            document: { title: "Senior Resume", type: "markdown", content: "# Senior Resume", source: null },
          },
        },
      },
      "ai-prompt-templates": {
        primary: {
          name: "AI Prompt Template",
          route: "ai-prompt-templates",
          data: {
            name: "Senior SWE Interview Template",
            document: {
              title: "Senior SWE Interview Template",
              type: "markdown",
              content: "Build an interview template for a Senior Software Engineer role.",
              source: null,
            },
          },
        },
      },
      "ai-prompts": {
        primary: {
          name: "AI Prompt",
          route: "ai-prompts",
          data: {
            name: "Prompt for Senior Engineer",
            aiName: "Test AI",
            aiUrl: "https://chat.openai.com",
            jobPosting: {
              title: "Senior Engineer",
              company: "Contoso",
              location: "Remote",
              salary: "$150,000",
              workModel: "Remote",
              url: "https://example.com/job/7",
              document: {
                title: "Senior Engineer",
                type: "markdown",
                content: "# Senior Engineer",
                source: "https://example.com/job/7",
              },
            },
            resume: {
              name: "Senior Resume",
              jobTitle: "Principal Engineer",
              date: "2026-01-15",
              document: { title: "Senior Resume", type: "markdown", content: "# Senior Resume", source: null },
            },
            aiPromptTemplate: {
              name: "Senior SWE Interview Template",
              document: {
                title: "Senior SWE Interview Template",
                type: "markdown",
                content: "Build an interview template for a Senior Software Engineer role.",
                source: null,
              },
            },
            promptDocument: { title: "ai prompt", type: "markdown", content: "# AI Prompt", source: null },
            responseDocument: { title: "ai response", type: "markdown", content: "You are fantastic", source: null },
          },
        },
        alternateJobPosting: {
          name: "Alternate Job Posting",
          route: "job-postings",
          data: {
            title: "Platform Engineer",
            company: "Fabrikam",
            location: "Austin, TX",
            salary: "$175,000",
            workModel: "Hybrid",
            url: "https://example.com/job/platform",
            document: {
              title: "Platform Engineer",
              type: "markdown",
              content: "# Platform Engineer",
              source: "https://example.com/job/platform",
            },
          },
        },
        alternateResume: {
          name: "Alternate Resume",
          route: "resumes",
          data: {
            name: "Platform Resume",
            jobTitle: "Staff Platform Engineer",
            date: "2026-02-20",
            document: { title: "Platform Resume", type: "markdown", content: "# Platform Resume", source: null },
          },
        },
        alternateAiPromptTemplate: {
          name: "Alternate AI Prompt Template",
          route: "ai-prompt-templates",
          data: {
            name: "Platform Interview Template",
            document: {
              title: "Platform Interview Template",
              type: "markdown",
              content: "Assess the candidate's platform engineering experience.",
              source: null,
            },
          },
        },
      },
      "job-sources": {
        primary: {
          name: "Job Source",
          route: "job-sources",
          data: {
            name: "LinkedIn",
          },
        },
      },
      "job-questions": {
        primary: {
          name: "Job Question",
          route: "job-questions",
          data: {
            question: "What makes you a good fit?",
            answer: "I enjoy solving problems and shipping software.",
          },
        },
      },
      "job-applications": {
        primary: {
          name: "Job Application",
          route: "job-applications",
          data: {
            company: "Contoso",
            role: "Senior Engineer",
            appliedOnDate: null,
            status: 1,
            sourceId: 0,
            jobPostingId: 0,
          },
        },
      },
    };

    test("Scenario: Adding an existing question pair to an application persists its shared reference", async ({ page }, testInfo) => {
      const question = await callServer({ page, testInfo, route: "job-questions", method: "POST", data: { question: "fdsa", answer: "asdf" } });
      expect(question.status).toBe(201);
      const config = {
        ...build_common_entity({ build_id: (segments: string[]) => build_tab_id(["job-applications", ...segments]) }),
        seeds: seedRecords["job-applications"],
      };
      const id = await seedTheDatabase({ page, testInfo, seeds: config.seeds });
      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();
      await expandSection({ page, config });
      await page.locator(config.editButtonId(id)).click();
      const editor = page.locator(config.formId());
      await editor.getByRole("button", { name: "Add questions", exact: true }).click();
      await editor.getByLabel("Question", { exact: true }).fill("fdsa");
      await editor.getByLabel("Answer", { exact: true }).fill("asdf");
      const saved = page.waitForResponse((response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/v1/job-applications/${id}`);
      await page.locator(config.saveButtonId(id)).click();
      const response = await saved;
      expect(response.ok(), await response.text()).toBeTruthy();
      expect(response.request().postDataJSON()).toEqual({ questions: [{ question: "fdsa", answer: "asdf" }] });
      await expect(editor).not.toBeVisible();
      const refreshed = page.waitForResponse((response) => response.request().method() === "GET" && new URL(response.url()).pathname === "/api/v1/job-applications");
      await page.locator(config.controlId("refresh-button")).click();
      expect((await refreshed).ok()).toBeTruthy();
      await expandRecordDetails({ page, config, entityId: id });
      await expect(page.locator(config.recordId(id)).locator(".value.questions")).toContainText("fdsa");
      await expect(page.locator(config.recordId(id)).locator(".value.questions")).toContainText("asdf");
      const stored = await page.request.get(`http://localhost:5000/api/v1/job-applications/${id}?deep=true`, { headers: getTestHeaders(testInfo) });
      expect(stored.ok()).toBeTruthy();
      expect((await stored.json()).questions).toEqual([expect.objectContaining({ id: question.json.id, question: "fdsa", answer: "asdf" })]);
      const questionConfig = {
        ...build_common_entity({ build_id: (segments: string[]) => build_tab_id(["job-questions", ...segments]) }),
        seeds: seedRecords["job-questions"],
      };
      await expandSection({ page, config: questionConfig });
      await expandRecordDetails({ page, config: questionConfig, entityId: question.json.id });
      const questionRow = page.locator(questionConfig.recordId(question.json.id));
      await expect(questionRow).toContainText("Referenced By");
      await expect(questionRow.locator(`a[href='${config.recordId(id)}']`)).toContainText(`Job Application ${id}`);
    });

    test("Scenario: Navigate to the DB Viewer screen", async ({ page }) => {
      // Given the user is using the JSA
      await page.goto("/");

      const dbViewerTab = page.getByRole("tab", { name: "DB Viewer" });
      const jobPostingsTab = page.getByRole("tab", { name: "Job Postings" });

      await expect(jobPostingsTab).toHaveAttribute("aria-selected", "true");
      await expect(dbViewerTab).toHaveAttribute("aria-selected", "false");

      // When the user clicks on the DB Viewer tab
      await dbViewerTab.click();

      // Then the page content will change to display the DB Viewer screen
      await expect(dbViewerTab).toHaveAttribute("aria-selected", "true");
      await expect(jobPostingsTab).toHaveAttribute("aria-selected", "false");

      const heading = page.getByRole("heading", { name: "DB Viewer", level: 1 });
      await expect(heading).toBeVisible();
    });

    test("Scenario: Daily backups list is visible in the DB Viewer tab", async ({ page }, testInfo) => {
      const created = await page.request.get("http://localhost:5000/api/v1/admin/db-snapshot", {
        headers: getTestHeaders(testInfo),
      });
      expect(created.ok()).toBeTruthy();
      const snapshot = await created.json();
      expect(snapshot.path).toContain("jsa_test_");
      const snapshotName = snapshot.path.split(/[\\/]/).at(-1);

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      const backupSection = page.locator("#db-viewer--db-backups");
      await expect(backupSection).toBeVisible();
      await expect(backupSection.locator("> .header .count")).toHaveText("1 record(s)");
      await backupSection.locator("> .header > .title").click();
      await expect(backupSection.locator("ul.data-list")).toContainText(snapshotName);
    });

    test("Scenario: Create Snapshot button creates a new daily snapshot", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();
      const backupSection = page.locator("#db-viewer--db-backups");
      await expect(backupSection.locator("> .header .count")).toHaveText("0 record(s)");
      const created = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/admin/db-snapshot");
      await page.locator("#db-viewer--db-backups--create-snapshot-button").click();
      const response = await created;
      expect(response.ok()).toBeTruthy();
      const snapshot = await response.json();
      expect(snapshot.path).toContain("jsa_test_");
      await expect(backupSection.locator("> .header .count")).toHaveText("1 record(s)");
      await backupSection.locator("> .header > .title").click();
      await expect(backupSection.locator("ul.data-list")).toContainText(snapshot.path.split(/[\\/]/).at(-1));
    });

    test("Scenario: Export button opens record selection and downloads JSON", async ({ page }, testInfo) => {
      const first = await callServer({
        page,
        testInfo,
        route: "job-postings",
        method: "POST",
        data: seedRecords["job-postings"].primary.data,
      });
      const second = await callServer({
        page,
        testInfo,
        route: "job-postings",
        method: "POST",
        data: seedRecords["ai-prompts"].alternateJobPosting.data,
      });

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      await page.locator("#db-viewer--job-postings--export-button").click();

      await expect(page.locator("#db-viewer--job-postings--export-dialog")).toBeVisible();
      const firstCheckbox = page.locator(`#db-viewer--job-postings--export-record-${first.json.id}-checkbox`);
      await expect(firstCheckbox).toBeVisible();
      await expect(page.locator(`#db-viewer--job-postings--export-record-${second.json.id}-checkbox`)).toBeVisible();
      await firstCheckbox.check();

      const downloadPromise = page.waitForEvent("download");
      await page.locator("#db-viewer--job-postings--export-confirm-button").click();
      const download = await downloadPromise;

      await expect(download.suggestedFilename()).toMatch(/\.json$/i);
      const stream = await download.createReadStream();
      expect(stream).not.toBeNull();
      const chunks: Buffer[] = [];
      for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
      const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      expect(exported.entity).toBe("Job Posting");
      expect(exported.records).toHaveLength(1);
      expect(exported.records[0]).toMatchObject({
        id: first.json.id,
        title: "Senior Engineer",
        document: { content: "# Senior Engineer" },
      });
    });

    test("Scenario: Canceling export closes the selection list", async ({ page }, testInfo) => {
      const created = await callServer({
        page,
        testInfo,
        route: "job-postings",
        method: "POST",
        data: seedRecords["job-postings"].primary.data,
      });
      expect(created.status).toBe(201);

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      await page.locator("#db-viewer--job-postings--export-button").click();
      await expect(page.locator("#db-viewer--job-postings--export-dialog")).toBeVisible();
      await expect(page.locator(`#db-viewer--job-postings--export-record-${created.json.id}-checkbox`)).toBeVisible();

      await page.locator("#db-viewer--job-postings--export-cancel-button").click();

      await expect(page.locator("#db-viewer--job-postings--export-dialog")).toBeHidden();
      const stored = await page.request.get(`http://localhost:5000/api/v1/job-postings/${created.json.id}`, {
        headers: getTestHeaders(testInfo),
      });
      expect(stored.ok()).toBeTruthy();
      expect(await stored.json()).toMatchObject({ id: created.json.id, title: "Senior Engineer" });
    });

    test.describe("Scenario Outline: Entity deletion can be confirmed or cancelled", () => {
      for (const entity of [
        { name: "Job Posting", route: "job-postings" },
        { name: "Resume", route: "resumes" },
        { name: "AI Prompt Template", route: "ai-prompt-templates" },
      ]) {
        for (const cancel of [false, true]) {
          test(`Entity: ${entity.name} ${cancel ? "Cancel" : "Delete"}`, async ({ page }, testInfo) => {
            const config = {
              ...build_common_entity({ build_id: (segments: string[]) => build_tab_id([entity.route, ...segments]) }),
              seeds: seedRecords[entity.route],
            };
            const id = await seedTheDatabase({ page, testInfo, seeds: config.seeds });
            await page.goto("/");
            await page.getByRole("tab", { name: "DB Viewer" }).click();
            await expandSection({ page, config });
            const row = page.locator(config.recordId(id));
            await row.getByRole("button", { name: "Delete", exact: true }).first().click();
            const dialog = page.locator(`#db-viewer--${entity.route}--delete-dialog`);
            await expect(dialog).toBeVisible();
            if (cancel) {
              await page.locator(`#db-viewer--${entity.route}--delete-cancel-button`).click();
              await expect(row).toBeVisible();
            } else {
              const deleted = page.waitForResponse((response) =>
                response.request().method() === "DELETE" && new URL(response.url()).pathname === `/api/v1/${entity.route}/${id}`);
              await page.locator(`#db-viewer--${entity.route}--delete-confirm-button`).click();
              const response = await deleted;
              expect(response.ok(), await response.text()).toBeTruthy();
              await expect(row).toHaveCount(0);
            }
            await expect(dialog).toBeHidden();
            const stored = await page.request.get(`http://localhost:5000/api/v1/${entity.route}/${id}`, {
              headers: getTestHeaders(testInfo),
            });
            expect(stored.status()).toBe(cancel ? 200 : 404);
            const document = await page.request.get(`http://localhost:5000/api/v1/documents/${config.seeds.primary.created!.documentId}`, {
              headers: getTestHeaders(testInfo),
            });
            expect(document.status()).toBe(cancel ? 200 : 404);
          });
        }
      }
    });

    test("Scenario: Import assigns new IDs automatically and highlights the imported records", async ({ page }, testInfo) => {
      const existingPosting = {
        title: "Existing Engineer",
        company: "Existing Co",
        location: "Remote",
        salary: "$130,000",
        workModel: "Remote",
        url: "https://example.com/job/existing",
        document: {
          title: "Existing Engineer",
          type: "markdown",
          content: "# Existing Engineer",
          source: "https://example.com/job/existing",
        },
      };

      const existingResponse = await callServer({
        page,
        testInfo,
        route: "job-postings",
        method: "POST",
        data: existingPosting,
      });
      const existingId = Number(existingResponse.json.id);
      expect(existingId > 0, "Seed record must be created before testing import ID handling.").toBeTruthy();

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      await page.locator("#db-viewer--job-postings--import-button").click();
      await expect(page.locator("#db-viewer--job-postings--import-dialog")).toBeVisible();

      await page.locator("#db-viewer--job-postings--import-file-input").setInputFiles({
        name: "job-postings-conflict.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            generatedAt: "2026-09-14T00:00:00Z",
            entity: "Job Posting",
            records: [
              {
                id: existingId,
                title: "Imported Engineer",
                company: "Imported Co",
                location: "Remote",
                salary: "$120,000",
                workModel: "Remote",
                url: "https://example.com/job/99",
                document: {
                  id: 900,
                  title: "Imported Engineer",
                  type: "markdown",
                  content: "# Imported Engineer",
                  source: "https://example.com/job/99",
                },
              },
            ],
          }),
        ),
      });

      await page.locator("#db-viewer--job-postings--import-confirm-button").click();

      const importedRow = page
        .locator("#db-viewer--job-postings--container ul.data-list > li")
        .filter({ hasText: "Imported Engineer" })
        .first();

      await expect(importedRow).toBeVisible({ timeout: 10000 });

      const importedResponse = await page.request.get("http://localhost:5000/api/v1/job-postings?deep=true", {
        headers: getTestHeaders(testInfo),
      });
      const importedRecords = await importedResponse.json();
      const importedRecord = importedRecords.find((record: any) => record.title === "Imported Engineer");
      expect(importedRecord, "The real server should save the imported record with a new ID.").toBeTruthy();

      const importedId = Number(importedRecord.id);
      expect(importedId).not.toBe(existingId);

      const importedRowById = page.locator(`#db-viewer--job-postings--container--record-${importedId}`);
      await expect(importedRowById).toBeVisible({ timeout: 5000 });
      await expectTransientHighlight(importedRowById);
    });

    test("Scenario: Import confirmation persists the selected file data to the real server", async ({ page }, testInfo) => {
      const flowHeaders = getTestHeaders(testInfo);
      const seedPayload = {
        title: "Server Seed Engineer",
        company: "Seed Co",
        location: "Remote",
        salary: "$140,000",
        workModel: "Remote",
        url: "https://example.com/job/seed",
        document: {
          title: "Server Seed Engineer",
          type: "markdown",
          content: "# Server Seed Engineer",
          source: "https://example.com/job/seed",
        },
      };

      const seedResponse = await callServer({
        page,
        testInfo,
        route: "job-postings",
        method: "POST",
        data: seedPayload,
      });
      expect(seedResponse.ok, "Seed record creation must succeed before import testing.").toBe(true);

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      await page.locator("#db-viewer--job-postings--import-button").click();
      await expect(page.locator("#db-viewer--job-postings--import-dialog")).toBeVisible();

      await page.locator("#db-viewer--job-postings--import-file-input").setInputFiles({
        name: "job-postings-import.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            generatedAt: "2026-09-14T00:00:00Z",
            entity: "Job Posting",
            records: [
              {
                id: 99,
                title: "Imported Engineer",
                company: "Imported Co",
                location: "Remote",
                salary: "$120,000",
                workModel: "Remote",
                url: "https://example.com/job/99",
                document: {
                  id: 900,
                  title: "Imported Engineer",
                  type: "markdown",
                  content: "# Imported Engineer",
                  source: "https://example.com/job/99",
                },
              },
            ],
          }),
        ),
      });

      await page.locator("#db-viewer--job-postings--import-confirm-button").click();

      await expect
        .poll(
          async () => {
            const response = await page.request.get("http://localhost:5000/api/v1/job-postings?deep=true", { headers: flowHeaders });
            if (!(await response.ok())) {
              return false;
            }

            const importedRecords = await response.json();
            return importedRecords.some((record: any) => record.title === "Imported Engineer");
          },
          { timeout: 5000 },
        )
        .toBeTruthy();

      const importedResponse = await page.request.get("http://localhost:5000/api/v1/job-postings?deep=true", {
        headers: flowHeaders,
      });
      const importedRecords = await importedResponse.json();
      const importedRecord = importedRecords.find((record: any) => record.title === "Imported Engineer");
      expect(importedRecord, "The real server should save the imported record.").toBeTruthy();

      const importedId = Number(importedRecord.id);
      const importedRecordRow = page.locator(`#db-viewer--job-postings--container--record-${importedId}`);
      await expect(importedRecordRow).toBeVisible({ timeout: 5000 });
      await expectTransientHighlight(importedRecordRow);
    });

    test("Scenario: Deleting an AI Prompt with child records lists the child records and deletes the selected set", async ({
      page,
    }, testInfo) => {
      const flowHeaders = getTestHeaders(testInfo);
      const jobPostingResponse = await callServer({
        page,
        testInfo,
        route: "job-postings",
        method: "POST",
        data: {
          title: "Delete Candidate Engineer",
          company: "Delete Co",
          location: "Remote",
          salary: "$120,000",
          workModel: "Remote",
          url: "https://example.com/job/delete-candidate",
          document: {
            title: "Delete Candidate Engineer",
            type: "markdown",
            content: "# Delete Candidate Engineer",
            source: "https://example.com/job/delete-candidate",
          },
        },
      });
      const jobPostingId = Number(jobPostingResponse.json.id);
      expect(jobPostingId > 0, "The job posting must exist before testing delete references.").toBeTruthy();

      const resumeResponse = await callServer({
        page,
        testInfo,
        route: "resumes",
        method: "POST",
        data: {
          name: "Resume for delete flow",
          jobTitle: "Senior Software Engineer",
          date: "2026-01-15",
          document: { title: "Resume for delete flow", type: "markdown", content: "# Resume", source: null },
        },
      });
      const resumeId = Number(resumeResponse.json.id);
      expect(resumeId > 0, "The resume must exist before creating the AI prompt.").toBeTruthy();

      const templateResponse = await callServer({
        page,
        testInfo,
        route: "ai-prompt-templates",
        method: "POST",
        data: {
          name: "Template for delete flow",
          document: { title: "Template for delete flow", type: "markdown", content: "# Template", source: null },
        },
      });
      const templateId = Number(templateResponse.json.id);
      expect(templateId > 0, "The AI prompt template must exist before creating the AI prompt.").toBeTruthy();

      const aiPromptResponse = await callServer({
        page,
        testInfo,
        route: "ai-prompts",
        method: "POST",
        data: {
          name: "Prompt that references the posting",
          aiName: "Test AI",
          aiUrl: "https://chat.openai.com",
          jobPostingId: jobPostingId,
          resumeId: resumeId,
          aiPromptTemplateId: templateId,
          promptDocument: { title: "prompt", type: "markdown", content: "# prompt", source: null },
          responseDocument: { title: "response", type: "markdown", content: "# response", source: null },
        },
      });
      const aiPromptId = Number(aiPromptResponse.json.id);
      expect(aiPromptId > 0, "The AI prompt must be created to exercise the referenced-record selection dialog.").toBeTruthy();

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();
      await page.locator("#db-viewer--ai-prompts--container > .header > .title").click();

      const deleteButton = page
        .locator(`#db-viewer--ai-prompts--container--record-${aiPromptId}`)
        .getByRole("button", { name: "Delete", exact: true });
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();

      const deleteDialog = page.locator("#db-viewer--ai-prompts--delete-dialog");
      await expect(deleteDialog).toBeVisible({ timeout: 10000 });
      await expect(deleteDialog).toContainText("Related records to include in the deletion:");
      await expect(deleteDialog).toContainText("Delete Candidate Engineer");
      await expect(deleteDialog).toContainText("Resume for delete flow");
      await expect(deleteDialog).toContainText("Template for delete flow");

      await page.locator(`#db-viewer--job-postings--delete-reference-${jobPostingId}-checkbox`).check();
      await page.locator(`#db-viewer--resumes--delete-reference-${resumeId}-checkbox`).check();
      await page.locator(`#db-viewer--ai-prompt-templates--delete-reference-${templateId}-checkbox`).check();
      await page.locator("#db-viewer--ai-prompts--delete-confirm-button").click();

      await expect
        .poll(
          async () => {
            const postings = await page.request.get("http://localhost:5000/api/v1/job-postings?deep=true", { headers: flowHeaders });
            if (!(await postings.ok())) {
              return false;
            }
            const postingRecords = await postings.json();
            const postingExists = postingRecords.some((record: any) => Number(record.id) === jobPostingId);

            const resumes = await page.request.get("http://localhost:5000/api/v1/resumes?deep=true", { headers: flowHeaders });
            if (!(await resumes.ok())) {
              return false;
            }
            const resumeRecords = await resumes.json();
            const resumeExists = resumeRecords.some((record: any) => Number(record.id) === resumeId);

            const templates = await page.request.get("http://localhost:5000/api/v1/ai-prompt-templates?deep=true", {
              headers: flowHeaders,
            });
            if (!(await templates.ok())) {
              return false;
            }
            const templateRecords = await templates.json();
            const templateExists = templateRecords.some((record: any) => Number(record.id) === templateId);

            const prompts = await page.request.get("http://localhost:5000/api/v1/ai-prompts?deep=true", { headers: flowHeaders });
            if (!(await prompts.ok())) {
              return false;
            }
            const promptRecords = await prompts.json();
            const promptExists = promptRecords.some((record: any) => Number(record.id) === aiPromptId);

            return !postingExists && !resumeExists && !templateExists && !promptExists;
          },
          { timeout: 10000 },
        )
        .toBeTruthy();
    });

    test("Scenario: Deleting a record can be cancelled without removing it", async ({ page }, testInfo) => {
      const flowHeaders = getTestHeaders(testInfo);
      const seed = {
        title: "Keep Candidate Engineer",
        company: "Keep Co",
        location: "Remote",
        salary: "$110,000",
        workModel: "Remote",
        url: "https://example.com/job/keep-candidate",
        document: {
          title: "Keep Candidate Engineer",
          type: "markdown",
          content: "# Keep Candidate Engineer",
          source: "https://example.com/job/keep-candidate",
        },
      };

      const seedResponse = await callServer({ page, testInfo, route: "job-postings", method: "POST", data: seed });
      const recordId = Number(seedResponse.json.id);
      expect(recordId > 0, "The seed record must exist before testing cancel delete behavior.").toBeTruthy();

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();
      await page.locator("#db-viewer--job-postings--container > .header > .title").click();

      const deleteButton = page
        .locator(`#db-viewer--job-postings--container--record-${recordId}`)
        .getByRole("button", { name: "Delete", exact: true });
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();

      const deleteDialog = page.locator("#db-viewer--job-postings--delete-dialog");
      await expect(deleteDialog).toBeVisible({ timeout: 10000 });
      await expect(deleteDialog).toBeFocused();
      await page.keyboard.press("Escape");

      await expect(deleteDialog).toBeHidden();
      await expect
        .poll(
          async () => {
            const response = await page.request.get("http://localhost:5000/api/v1/job-postings?deep=true", {
              headers: flowHeaders,
            });
            if (!(await response.ok())) {
              return false;
            }

            const records = await response.json();
            return records.some((record: any) => Number(record.id) === recordId);
          },
          { timeout: 10000 },
        )
        .toBeTruthy();
    });

    test("Scenario: Deleting a record can be confirmed with the keyboard", async ({ page }, testInfo) => {
      const flowHeaders = getTestHeaders(testInfo);
      const seed = {
        title: "Keyboard Confirm Engineer",
        company: "Keyboard Co",
        location: "Remote",
        salary: "$120,000",
        workModel: "Remote",
        url: "https://example.com/job/keyboard-confirm",
        document: {
          title: "Keyboard Confirm Engineer",
          type: "markdown",
          content: "# Keyboard Confirm Engineer",
          source: "https://example.com/job/keyboard-confirm",
        },
      };

      const seedResponse = await callServer({ page, testInfo, route: "job-postings", method: "POST", data: seed });
      const recordId = Number(seedResponse.json.id);
      expect(recordId > 0, "The seed record must exist before testing keyboard confirmation.").toBeTruthy();

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();
      await page.locator("#db-viewer--job-postings--container > .header > .title").click();

      const deleteButton = page
        .locator(`#db-viewer--job-postings--container--record-${recordId}`)
        .getByRole("button", { name: "Delete", exact: true });
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();

      const deleteDialog = page.locator("#db-viewer--job-postings--delete-dialog");
      await expect(deleteDialog).toBeVisible({ timeout: 10000 });
      await expect(deleteDialog).toBeFocused();
      await page.keyboard.press("d");

      await expect(deleteDialog).toBeHidden();
      await expect
        .poll(
          async () => {
            const response = await page.request.get("http://localhost:5000/api/v1/job-postings?deep=true", {
              headers: flowHeaders,
            });
            if (!(await response.ok())) {
              return false;
            }

            const records = await response.json();
            return !records.some((record: any) => Number(record.id) === recordId);
          },
          { timeout: 10000 },
        )
        .toBeTruthy();
    });

    test("Scenario: Deleting a record that is being referenced by another record shows a foreign-key error", async ({ page }, testInfo) => {
      const flowHeaders = getTestHeaders(testInfo);

      const jobPostingResponse = await callServer({
        page,
        testInfo,
        route: "job-postings",
        method: "POST",
        data: {
          title: "Referenced Job Posting",
          company: "Reference Co",
          location: "Remote",
          salary: "$95,000",
          workModel: "Remote",
          url: "https://example.com/job/referenced",
          document: {
            title: "Referenced Job Posting",
            type: "markdown",
            content: "# Referenced Job Posting",
            source: "https://example.com/job/referenced",
          },
        },
      });
      const jobPostingId = Number(jobPostingResponse.json.id);
      expect(jobPostingId > 0, "The source job posting must exist before creating a referencing AI prompt.").toBeTruthy();

      const resumeResponse = await callServer({
        page,
        testInfo,
        route: "resumes",
        method: "POST",
        data: {
          name: "Referenced Resume",
          jobTitle: "Engineer",
          date: "2026-01-10",
          document: { title: "Referenced Resume", type: "markdown", content: "# Resume", source: null },
        },
      });
      const resumeId = Number(resumeResponse.json.id);
      expect(resumeId > 0, "The source resume must exist before creating a referencing AI prompt.").toBeTruthy();

      const templateResponse = await callServer({
        page,
        testInfo,
        route: "ai-prompt-templates",
        method: "POST",
        data: {
          name: "Referenced Template",
          document: { title: "Referenced Template", type: "markdown", content: "# Template", source: null },
        },
      });
      const templateId = Number(templateResponse.json.id);
      expect(templateId > 0, "The source AI prompt template must exist before creating a referencing AI prompt.").toBeTruthy();

      const promptResponse = await callServer({
        page,
        testInfo,
        route: "ai-prompts",
        method: "POST",
        data: {
          name: "Prompt references the target",
          aiUrl: "https://chat.openai.com",
          aiName: "Test AI",
          jobPostingId: jobPostingId,
          resumeId: resumeId,
          aiPromptTemplateId: templateId,
          promptDocument: { title: "prompt", type: "markdown", content: "# prompt", source: null },
          responseDocument: { title: "response", type: "markdown", content: "# response", source: null },
        },
      });
      const promptId = Number(promptResponse.json.id);
      expect(promptId > 0, "The referencing AI prompt must exist so the target record is under a foreign-key dependency.").toBeTruthy();

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();
      await page.locator("#db-viewer--job-postings--container > .header > .title").click();

      const deleteButton = page
        .locator(`#db-viewer--job-postings--container--record-${jobPostingId}`)
        .getByRole("button", { name: "Delete", exact: true });
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();

      const deleteDialog = page.locator("#db-viewer--job-postings--delete-dialog");
      const failureDialog = page.locator("#db-viewer--job-postings--delete-failure-dialog");
      await expect(deleteDialog).toBeVisible({ timeout: 10000 });
      await page.locator("#db-viewer--job-postings--delete-confirm-button").click();

      await expect(failureDialog).toBeVisible({ timeout: 10000 });
      const promptReferenceLink = failureDialog.locator(`a[href='#db-viewer--ai-prompts--container--record-${promptId}']`);
      await expect(failureDialog).toContainText(`AI Prompt ${promptId}`, { timeout: 10000 });
      await expect(failureDialog).toContainText("Delete the AI Prompt records first", { timeout: 10000 });
      await expect(promptReferenceLink).toContainText(`AI Prompt ${promptId}`);
      await expect(failureDialog.getByRole("button", { name: "Delete" })).toHaveCount(0);
      await expect(failureDialog.getByRole("button", { name: "Dismiss" })).toBeVisible({ timeout: 10000 });
      await expect(deleteDialog).toBeHidden();

      await expect
        .poll(
          async () => {
            const response = await page.request.get("http://localhost:5000/api/v1/job-postings?deep=true", { headers: flowHeaders });
            if (!(await response.ok())) {
              return false;
            }
            const records = await response.json();
            return records.some((record: any) => Number(record.id) === jobPostingId);
          },
          { timeout: 10000 },
        )
        .toBeTruthy();
    });

    test("Scenario: Dismissing a delete failure dialog works with keyboard shortcuts", async ({ page }, testInfo) => {
      const flowHeaders = getTestHeaders(testInfo);

      const jobPostingResponse = await callServer({
        page,
        testInfo,
        route: "job-postings",
        method: "POST",
        data: {
          title: "Delete Failure Keyboard Test Job Posting",
          company: "Reference Co",
          location: "Remote",
          salary: "$95,000",
          workModel: "Remote",
          url: "https://example.com/job/keyboard-dismiss",
          document: {
            title: "Delete Failure Keyboard Test Job Posting",
            type: "markdown",
            content: "# Delete Failure Keyboard Test Job Posting",
            source: "https://example.com/job/keyboard-dismiss",
          },
        },
      });
      const jobPostingId = Number(jobPostingResponse.json.id);
      expect(jobPostingId > 0, "The source job posting must exist before creating a referencing AI prompt.").toBeTruthy();

      const resumeResponse = await callServer({
        page,
        testInfo,
        route: "resumes",
        method: "POST",
        data: {
          name: "Delete Failure Keyboard Test Resume",
          jobTitle: "Engineer",
          date: "2026-01-10",
          document: { title: "Delete Failure Keyboard Test Resume", type: "markdown", content: "# Resume", source: null },
        },
      });
      const resumeId = Number(resumeResponse.json.id);
      expect(resumeId > 0, "The source resume must exist before creating a referencing AI prompt.").toBeTruthy();

      const templateResponse = await callServer({
        page,
        testInfo,
        route: "ai-prompt-templates",
        method: "POST",
        data: {
          name: "Delete Failure Keyboard Test Template",
          document: { title: "Delete Failure Keyboard Test Template", type: "markdown", content: "# Template", source: null },
        },
      });
      const templateId = Number(templateResponse.json.id);
      expect(templateId > 0, "The source AI prompt template must exist before creating a referencing AI prompt.").toBeTruthy();

      const promptResponse = await callServer({
        page,
        testInfo,
        route: "ai-prompts",
        method: "POST",
        data: {
          name: "Prompt references the target for keyboard dismissal",
          aiUrl: "https://chat.openai.com",
          aiName: "Test AI",
          jobPostingId: jobPostingId,
          resumeId: resumeId,
          aiPromptTemplateId: templateId,
          promptDocument: { title: "prompt", type: "markdown", content: "# prompt", source: null },
          responseDocument: { title: "response", type: "markdown", content: "# response", source: null },
        },
      });
      const promptId = Number(promptResponse.json.id);
      expect(promptId > 0, "The referencing AI prompt must exist so the target record is under a foreign-key dependency.").toBeTruthy();

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();
      await page.locator("#db-viewer--job-postings--container > .header > .title").click();

      const deleteButton = page
        .locator(`#db-viewer--job-postings--container--record-${jobPostingId}`)
        .getByRole("button", { name: "Delete", exact: true });
      const deleteDialog = page.locator("#db-viewer--job-postings--delete-dialog");
      const failureDialog = page.locator("#db-viewer--job-postings--delete-failure-dialog");
      const dismissalKeys = ["Escape", "Enter", " ", "d", "D"];

      for (const key of dismissalKeys) {
        await expect(deleteButton).toBeVisible({ timeout: 10000 });
        await deleteButton.click();
        await expect(deleteDialog).toBeVisible({ timeout: 10000 });
        await expect(deleteDialog).toHaveAttribute("role", "dialog");

        await page.locator("#db-viewer--job-postings--delete-confirm-button").focus();
        await page.keyboard.press("Enter");

        await expect(failureDialog).toBeVisible({ timeout: 10000 });
        await expect(failureDialog).toHaveAttribute("role", "alertdialog");
        await failureDialog.focus();
        await page.keyboard.press(key);
        await expect(failureDialog).toBeHidden({ timeout: 10000 });

        const response = await page.request.get("http://localhost:5000/api/v1/job-postings?deep=true", { headers: flowHeaders });
        expect(await response.ok()).toBeTruthy();
        const records = await response.json();
        expect(records.some((record: any) => Number(record.id) === jobPostingId)).toBeTruthy();

        await expect(deleteButton).toBeVisible({ timeout: 10000 });
      }
    });

    test("Scenario: Importing an AI Prompt with nested job, resume, and template references succeeds", async ({ page }, testInfo) => {
      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      await page.locator("#db-viewer--ai-prompts--import-button").click();
      await expect(page.locator("#db-viewer--ai-prompts--import-dialog")).toBeVisible();

      await page.locator("#db-viewer--ai-prompts--import-file-input").setInputFiles({
        name: "ai-prompt-export.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            generatedAt: "2026-09-14T17:35:24.819Z",
            entity: "AI Prompt",
            records: [
              {
                name: "asdf vs Senior Software Engineer",
                aiName: "Copilot",
                aiUrl: "https://copilot.microsoft.com/",
                jobPosting: {
                  title: "Senior Software Engineer",
                  company: "Acme Corp",
                  location: "Remote",
                  salary: "$150,000 - $180,000 a year",
                  url: "https://www.indeed.com/viewjob?jk=455de5af61ae4e7a",
                  workModel: "Remote",
                  document: {
                    title: "Senior Software Engineer",
                    type: "Markdown",
                    content: "# Senior Software Engineer",
                    source: "https://www.indeed.com/viewjob?jk=455de5af61ae4e7a",
                    id: 4,
                  },
                  documentId: 4,
                  id: 2,
                },
                jobPostingId: 2,
                resume: {
                  name: "asdf",
                  jobTitle: "wefzxc asdf yuio",
                  date: "2026-09-13T00:00:00-07:00",
                  document: {
                    title: "wefzxc asdf yuio",
                    type: "Markdown",
                    content: "# resume me\nto be or not to be",
                    id: 2,
                  },
                  documentId: 2,
                  id: 1,
                },
                resumeId: 1,
                aiPromptTemplate: {
                  name: "Resume Job Fit Analysis",
                  document: {
                    title: "Resume Job Fit Analysis",
                    type: "Markdown",
                    content: "I want a structured job-fit assessment.",
                    id: 1,
                  },
                  documentId: 1,
                  id: 1,
                },
                aiPromptTemplateId: 1,
                promptDocument: {
                  title: "asdf vs Senior Software Engineer prompt",
                  type: "Markdown",
                  content: "Prompt content",
                  id: 6,
                },
                promptDocumentId: 6,
                responseDocument: {
                  title: "asdf vs Senior Software Engineer response",
                  type: "Markdown",
                  content: "Response content",
                  id: 7,
                },
                responseDocumentId: 7,
                id: 1,
              },
            ],
          }),
        ),
      });

      const importedAiPromptName = "asdf vs Senior Software Engineer";
      const importedRecordRow = page.locator("#db-viewer--ai-prompts--container ul.data-list > li").filter({ hasText: importedAiPromptName }).first();

      await page.locator("#db-viewer--ai-prompts--import-confirm-button").click();

      await expect
        .poll(
          async () => {
            const response = await page.request.get("http://localhost:5000/api/v1/ai-prompts?deep=true", {
              headers: getTestHeaders(testInfo),
            });
            if (!(await response.ok())) {
              return false;
            }

            const records = await response.json();
            return records.some((record: any) => record.name === importedAiPromptName);
          },
          { timeout: 10000 },
        )
        .toBeTruthy();

      const importedResponse = await page.request.get("http://localhost:5000/api/v1/ai-prompts?deep=true", {
        headers: getTestHeaders(testInfo),
      });
      const importedRecords = await importedResponse.json();
      const importedRecord = importedRecords.find((record: any) => record.name === importedAiPromptName);
      expect(importedRecord, "The imported AI Prompt should be persisted to the real server.").toBeTruthy();
      expect(importedRecord.aiName).toBe("Copilot");
      expect(Number(importedRecord.id)).toBeGreaterThan(0);

      await expect(importedRecordRow).toBeVisible({ timeout: 5000 });
      await expectTransientHighlight(importedRecordRow);
    });

    test("Scenario: Refresh failure for a DB Viewer tab is visible to the user", async ({ page }) => {
      let shouldFailJobPostingRefresh = false;

      await page.route("**/api/v1/job-postings**", async (route) => {
        const req = route.request();

        if (req.method() === "GET" && shouldFailJobPostingRefresh && req.url().includes("/api/v1/job-postings")) {
          await route.fulfill({
            status: 500,
            contentType: "text/plain",
            body: "Job posting refresh failed",
          });
          return;
        }

        await route.continue();
      });

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();
      const section = page.locator("#db-viewer--job-postings--container");
      await section.locator("> .header > .title").click();
      await expect(section.locator(".empty-list:not(.loading)")).toBeVisible();

      shouldFailJobPostingRefresh = true;
      const refreshResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response.url().includes("/api/v1/job-postings") &&
          response.url().includes("deep=true") &&
          response.status() === 500,
      );

      await section.getByRole("button", { name: "Refresh records", exact: true }).click();
      await refreshResponse;

      await expect(page.locator("#db-viewer--job-postings--refresh-status")).toContainText(
        "Unable to refresh Job Posting. (500: Job posting refresh failed)",
      );
    });

    test.describe("Scenario Outline: Entities visible in the DB Viewer", () => {
      type LocalEntityConfig = EntityConfig & {
        name: string;
        checkField: string;
        checkFieldObjectKey: string;
      };

      test("Entity: Job Posting", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Job Posting",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-postings", ...segments]),
          }),
          checkField: "editor--title",
          checkFieldObjectKey: "title",

          seeds: seedRecords["job-postings"],
        };

        await runTest_listIsVisible({ page, testInfo, config });
      });

      test("Entity: Resume", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Resume",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["resumes", ...segments]),
          }),
          checkField: "editor--name",
          checkFieldObjectKey: "name",

          seeds: seedRecords["resumes"],
        };

        await runTest_listIsVisible({ page, testInfo, config });
      });

      test("Entity: AI Prompt Template", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "AI Prompt Template",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompt-templates", ...segments]),
          }),
          checkField: "editor--name",
          checkFieldObjectKey: "name",

          seeds: seedRecords["ai-prompt-templates"],
        };

        await runTest_listIsVisible({ page, testInfo, config });
      });

      test("Entity: AI Prompt", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "AI Prompt",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompts", ...segments]),
          }),
          checkField: "editor--name",
          checkFieldObjectKey: "name",

          seeds: seedRecords["ai-prompts"],
        };

        await runTest_listIsVisible({ page, testInfo, config });
      });

      test("Entity: Job Application", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Job Application",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-applications", ...segments]),
          }),
          checkField: "editor--company",
          checkFieldObjectKey: "company",

          seeds: seedRecords["job-applications"],
        };

        await runTest_listIsVisible({ page, testInfo, config });
      });

      test("Entity: Job Source", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Job Source",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-sources", ...segments]),
          }),
          checkField: "editor--name",
          checkFieldObjectKey: "name",

          seeds: seedRecords["job-sources"],
        };

        await runTest_listIsVisible({ page, testInfo, config });
      });

      test("Entity: Job Question", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Job Question",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-questions", ...segments]),
          }),
          checkField: "editor--question",
          checkFieldObjectKey: "question",

          seeds: seedRecords["job-questions"],
        };

        await runTest_listIsVisible({ page, testInfo, config });
      });

      async function runTest_listIsVisible({ page, testInfo, config }: { page: Page; testInfo: TestInfo; config: LocalEntityConfig }) {
        const entityId = await seedTheDatabase({ page, testInfo, seeds: config.seeds });

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();

        await expandSection({ page, config });

        const expander = page.locator(config.container());

        await expect(expander).toBeVisible();
        await expect(expander).toContainText(config.name);

        await expect(expander.locator("> .header .count")).toHaveText("1 record(s)");
        await expect(expander.getByRole("button", { name: "Refresh records", exact: true })).toBeVisible();

        await expect(expander.locator("ul.data-list")).toBeVisible();

        const rowSummary = expander.locator("ul.data-list > li .expander > .header > .title").first();
        await expect(rowSummary).toContainText(String(entityId));
        await expect(rowSummary).toContainText(config.seeds.primary.data[config.checkFieldObjectKey]);
      }
    });

    test.describe("Scenario Outline: New records can be created in the DB Viewer", () => {
      type LocalEntityConfig = {
        name: string;
        route: string;
        createButtonId: string;
        formId: string;
        saveButtonId: string;
        countId: string;
        listId: string;
        setup?: (args: { page: Page; testInfo: TestInfo }) => Promise<Record<string, string>>;
        fields: Array<{ field: string; value: string }>;
        expectedText: string;
      };

      test("Entity: Job Posting", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Job Posting",
          route: "job-postings",
          createButtonId: "#db-viewer--job-postings--create-button",
          formId: "#db-viewer--job-postings--editor",
          saveButtonId: "#db-viewer--job-postings--editor--save-button",
          countId: "#db-viewer--job-postings--count",
          listId: "#db-viewer--job-postings--list",
          fields: [
            { field: "title", value: "Principal Engineer" },
            { field: "company", value: "Northwind" },
            { field: "location", value: "Seattle, WA" },
            { field: "salary", value: "$210,000" },
            { field: "work-model", value: "Hybrid" },
            { field: "url", value: "https://example.com/job/principal" },
            { field: "document--type", value: "Markdown" },
            { field: "document--content", value: "# Principal Engineer" },
          ],
          expectedText: "Principal Engineer",
        };

        await runTest_createWorkflow({ page, testInfo, config });
      });

      test("Entity: Job Source", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Job Source",
          route: "job-sources",
          createButtonId: "#db-viewer--job-sources--create-button",
          formId: "#db-viewer--job-sources--editor",
          saveButtonId: "#db-viewer--job-sources--editor--save-button",
          countId: "#db-viewer--job-sources--count",
          listId: "#db-viewer--job-sources--list",
          fields: [{ field: "name", value: "Indeed" }],
          expectedText: "Indeed",
        };

        await runTest_createWorkflow({ page, testInfo, config });
      });

      test("Entity: Job Application", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config: LocalEntityConfig = {
          name: "Job Application",
          route: "job-applications",
          createButtonId: "#db-viewer--job-applications--create-button",
          formId: "#db-viewer--job-applications--editor",
          saveButtonId: "#db-viewer--job-applications--editor--save-button",
          countId: "#db-viewer--job-applications--count",
          listId: "#db-viewer--job-applications--list",
          setup: async ({ page, testInfo }) => {
            const sourceResponse = await callServer({
              page,
              testInfo,
              route: "job-sources",
              method: "POST",
              data: { name: "LinkedIn" },
            });

            const postingResponse = await callServer({
              page,
              testInfo,
              route: "job-postings",
              method: "POST",
              data: {
                title: "Platform Engineer",
                company: "Fabrikam",
                location: "Austin, TX",
                salary: "$175,000",
                workModel: "Hybrid",
                url: "https://example.com/job/platform",
                document: {
                  title: "Platform Engineer",
                  type: "markdown",
                  content: "# Platform Engineer",
                  source: "https://example.com/job/platform",
                },
              },
            });

            return {
              "source--id": String(sourceResponse.json.id),
              "job-posting--id": String(postingResponse.json.id),
            };
          },
          fields: [
            { field: "company", value: "Northwind" },
            { field: "role", value: "Principal Engineer" },
            { field: "applied-on-date", value: "2026-09-15" },
            { field: "status", value: "Draft" },
          ],
          expectedText: "Northwind",
        };

        await runTest_createWorkflow({ page, testInfo, config });
      });

      async function runTest_createWorkflow({ page, testInfo, config }: { page: Page; testInfo: TestInfo; config: LocalEntityConfig }) {
        const initialLoad = page.waitForResponse(
          (response) => response.request().method() === "GET" && new URL(response.url()).pathname === `/api/v1/${config.route}`,
        );
        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();
        expect((await initialLoad).ok()).toBeTruthy();

        const setupValues = config.setup ? await config.setup({ page, testInfo }) : {};

        const section = page.locator(`#db-viewer--${config.route}--container`);
        await section.locator("> .header > .title").click();
        await expect(section.locator(".empty-list:not(.loading)")).toBeVisible();
        await section.getByRole("button", { name: "Create", exact: true }).click();
        const editor = section.locator("li[id$='--record-0'] [id^='entity-editor-']");
        await expect(editor).toBeVisible();

        for (const fieldConfig of config.fields) {
          const value = fieldConfig.value;
          const control = fieldConfig.field.startsWith("document--")
            ? editor.locator(".document--editor.embedded").getByLabel(fieldLabel(fieldConfig.field.slice("document--".length)), { exact: true })
            : editor.getByLabel(fieldLabel(fieldConfig.field), { exact: true });
          const tagName = await control.evaluate((element) => element.tagName.toLowerCase());

          if (tagName === "select") {
            await control.selectOption(value);
          } else {
            await control.fill(value);
          }
        }

        for (const [field, value] of Object.entries(setupValues)) {
          const control = editor.getByLabel(fieldLabel(field), { exact: true });
          const tagName = await control.evaluate((element) => element.tagName.toLowerCase());
          if (tagName === "select") {
            await control.selectOption(value);
          } else {
            await control.fill(value);
          }
        }

        const createRequest = page.waitForRequest((request) => {
          return request.method() === "POST" && request.url().endsWith(`/api/v1/${config.route}`) && request.postData() !== null;
        });

        const createResponse = page.waitForResponse((response) => {
          return response.request().method() === "POST" && response.url().endsWith(`/api/v1/${config.route}`);
        });

        await editor.locator("> .header").getByRole("button", { name: "Save", exact: true }).click();

        await createRequest;
        const response = await createResponse;
        expect(response.status(), await response.text()).toBe(201);

        await expect(section.locator("> .header .count")).toHaveText("1 record(s)");
        await expect(section.locator("ul.data-list")).toContainText(config.expectedText);
      }
    });

    test.describe("Scenario Outline: Entity list items are expandable", () => {
      type LocalEntityConfig = DbViewer.EntityConfig;

      test("Entity: Job Posting", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Job Posting",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-postings", ...segments]),
          }),
          seeds: seedRecords["job-postings"],
        };

        await runTest_entityListItemsExpandable({ page, testInfo, config });
      });

      test("Entity: Resume", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Resume",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["resumes", ...segments]),
          }),
          seeds: seedRecords["resumes"],
        };

        await runTest_entityListItemsExpandable({ page, testInfo, config });
      });

      test("Entity: AI Prompt Template", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "AI Prompt Template",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompt-templates", ...segments]),
          }),
          seeds: seedRecords["ai-prompt-templates"],
        };

        await runTest_entityListItemsExpandable({ page, testInfo, config });
      });

      test("Entity: AI Prompt", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "AI Prompt",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompts", ...segments]),
          }),
          seeds: seedRecords["ai-prompts"],
        };

        await runTest_entityListItemsExpandable({ page, testInfo, config });
      });

      async function runTest_entityListItemsExpandable({
        page,
        testInfo,
        config,
      }: {
        page: Page;
        testInfo: TestInfo;
        config: LocalEntityConfig;
      }) {
        const entityId = await seedTheDatabase({ page, testInfo, seeds: config.seeds });

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();
        await expandSection({ page, config });

        const row = page.locator(config.recordId(entityId));
        await expect(row).toBeVisible();

        const expander = row.locator(".expander").first();
        await expect(expander).toBeVisible();
        await expect(expander).toHaveClass(/\bcollapsed\b/);

        const summary = expander.locator("> .header > .title");
        const summaryText = await summary.textContent();
        expect(summaryText).toContain(String(entityId));

        const detailContent = expander.locator("> .expanded");
        await expect(detailContent).not.toBeVisible();

        const expectedSummaryValue = (() => {
          if (config.name === "Job Posting") return config.seeds.primary.data.title;
          return config.seeds.primary.data.name;
        })();

        await expect(summary).toContainText(String(entityId));
        await expect(summary).toContainText(expectedSummaryValue);
        await expect(detailContent).not.toBeVisible();

        await summary.click();
        await expect(expander).toHaveClass(/\bexpanded\b/);
        await expect(detailContent).toBeVisible();
        await expect(summary).toContainText(expectedSummaryValue);
      }
    });

    test.describe("Scenario Outline: Entities link to referenced entities", () => {
      type LocalEntityConfig = DbViewer.EntityConfig & {
        assert: TestAction;
      };

      test("Entity: Job Posting", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Job Posting",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-postings", ...segments]),
          }),

          seeds: seedRecords["job-postings"],
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkToReferencedEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const summary = row.locator(".expander > .header > .title").first();
          await expect(summary).toContainText(String(record.id));
          await expect(summary).toContainText(record.title ?? "");
          await expect(summary.locator("a")).toHaveCount(0);
          await expect(row.locator("a.db-viewer-list-item-read-header-link")).toHaveCount(0);
        }
      });

      test(`Entity: Resume`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Resume",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["resumes", ...segments]),
          }),

          seeds: seedRecords["resumes"],
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkToReferencedEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const summary = row.locator(".expander > .header > .title").first();
          await expect(summary).toContainText(String(record.id));
          await expect(summary).toContainText(record.name ?? "");
          await expect(row.locator("a.db-viewer-list-item-read-header-link")).toHaveCount(0);
        }
      });

      test(`Entity: AI Prompt Template`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "AI Prompt Template",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompt-templates", ...segments]),
          }),

          seeds: seedRecords["ai-prompt-templates"],
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkToReferencedEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const summary = row.locator(".expander > .header > .title").first();
          await expect(summary).toContainText(String(record.id));
          await expect(summary).toContainText(record.name ?? "");
          await expect(row.locator("a.db-viewer-list-item-read-header-link")).toHaveCount(0);
        }
      });

      test(`Entity: AI Prompt`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "AI Prompt",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompts", ...segments]),
          }),

          seeds: seedRecords["ai-prompts"],
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkToReferencedEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const summary = row.locator(".expander > .header > .title").first();
          await expect(summary).toContainText(String(record.id));
          await expect(summary).toContainText(record.name ?? "");

          const jobPostingId = Number(record.jobPostingId ?? record.jobPosting?.id ?? record.id);
          const resumeId = Number(record.resumeId ?? record.resume?.id ?? record.id);
          const aiPromptTemplateId = Number(record.aiPromptTemplateId ?? record.aiPromptTemplate?.id ?? record.id);

          await expect(row.locator(".outgoing-reference a")).toHaveCount(3);
          for (const target of [
            { route: "job-postings", id: jobPostingId, name: record.jobPosting.title },
            { route: "resumes", id: resumeId, name: record.resume.name },
            { route: "ai-prompt-templates", id: aiPromptTemplateId, name: record.aiPromptTemplate.name },
          ]) {
            const targetId = `#db-viewer--${target.route}--container--record-${target.id}`;
            const link = row.locator(`.outgoing-reference a[href='${targetId}']`);
            await expect(link).toContainText(target.name);
            await link.click();
            await expect(page.locator(targetId)).toBeVisible();
            await expect(page.locator(targetId).locator(".expander").first()).toHaveClass(/\bexpanded\b/);
          }
        }
      });

      async function runTest_entitiesLinkToReferencedEntities({
        page,
        testInfo,
        config,
      }: {
        page: Page;
        testInfo: TestInfo;
        config: LocalEntityConfig;
      }) {
        const entityId = await seedTheDatabase({ page, testInfo, seeds: config.seeds });

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();

        await page.locator(config.container()).scrollIntoViewIfNeeded();

        await expandSection({ page, config });

        const recordId = config.recordId(entityId);

        const row = page.locator(recordId);

        await expect(row).toBeVisible();
        await expandRecordDetails({ page, config, entityId });

        await config.assert({ page, config, testInfo });
      }
    });

    // test.describe("Scenario: Referenced records link back to referencing records", () => {
    test.describe("Scenario Outline: Referenced records show incoming references in the Referenced By section", () => {
      type LocalEntityConfig = DbViewer.EntityConfig & {
        assert: TestAction;
      };

      test("Entity: Job Posting", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Job Posting",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-postings", ...segments]),
          }),

          seeds: seedRecords["ai-prompts"],
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkBackToReferencingEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created!.jobPosting;
          const aiPrompt = config.seeds.primary.created!;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const sourceResponse = await callServer({
            page,
            testInfo,
            route: "job-sources",
            method: "POST",
            data: { name: "LinkedIn" },
          });

          const jobApplicationResponse = await callServer({
            page,
            testInfo,
            route: "job-applications",
            method: "POST",
            data: {
              company: "Application Co",
              role: "Application Role",
              appliedOnDate: null,
              status: 1,
              sourceId: sourceResponse.json.id,
              jobPostingId: record.id,
            },
          });

          const jobApplicationId = Number(jobApplicationResponse.json.id);
          expect(jobApplicationId > 0, "The job application record should exist for the incoming-reference test.").toBeTruthy();

          await page.reload();
          await page.getByRole("tab", { name: "DB Viewer" }).click();
          await page.locator(config.container()).scrollIntoViewIfNeeded();
          await expandSection({ page, config });
          await expandRecordDetails({ page, config, entityId: record.id });

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const recordRow = page.locator(config.recordId(record.id));
          await expect(recordRow).toContainText("Referenced By");

          const aiPromptLink = recordRow.locator(`a[href='#db-viewer--ai-prompts--container--record-${aiPrompt.id}']`);
          await expect(aiPromptLink).toContainText(`AI Prompt ${aiPrompt.id} · ${aiPrompt.name}`);

          const jobApplicationLink = recordRow.locator(`a[href='#db-viewer--job-applications--container--record-${jobApplicationId}']`);
          await expect(jobApplicationLink).toContainText(`Job Application ${jobApplicationId} · Application Co`);

          await verifyBackReferenceWorks(page, recordRow, aiPrompt as { id: number; name: string });

          await expect(jobApplicationLink).toBeVisible();
          await clickDbViewerReferenceLink(jobApplicationLink);
          await expect(page.locator(`#db-viewer--job-applications--container--record-${jobApplicationId}`)).toBeVisible();
          await expect(page.locator(`#db-viewer--job-applications--container`)).toHaveClass(/\bexpanded\b/);
        }
      });

      test("Entity: Resume", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Resume",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["resumes", ...segments]),
          }),

          seeds: seedRecords["ai-prompts"],
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkBackToReferencingEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created!.resume;
          const aiPrompt = config.seeds.primary.created!;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const recordRow = page.locator(config.recordId(record.id));
          await expect(recordRow).toContainText("Referenced By");

          await verifyBackReferenceWorks(page, recordRow, aiPrompt as { id: number; name: string });
        }
      });

      test("Entity: AI Prompt Template", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "AI Prompt Template",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompt-templates", ...segments]),
          }),

          seeds: seedRecords["ai-prompts"],
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkBackToReferencingEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created!.aiPromptTemplate;
          const aiPrompt = config.seeds.primary.created!;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const recordRow = page.locator(config.recordId(record.id));
          await expect(recordRow).toContainText("Referenced By");

          await verifyBackReferenceWorks(page, recordRow, aiPrompt as { id: number; name: string });
        }
      });

      test("Entity: AI Prompt", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "AI Prompt",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompts", ...segments]),
          }),

          seeds: seedRecords["ai-prompts"],
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkBackToReferencingEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created;
          const aiPrompt = config.seeds.primary.created!;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const row = page.locator(config.recordId(aiPrompt.id));
          await expect(row.getByText("Referenced By", { exact: true })).toHaveCount(0);

          // const row = page.locator(config.recordId(record.id));
          // await expect(row).toBeVisible();

          // const recordRow = page.locator(config.recordId(record.id));
          // await expect(recordRow).toContainText("Referenced By");

          // await verifyBackReferenceWorks(page, recordRow, aiPrompt as { id: number; name: string });
        }
      });

      for (const entity of [
        { name: "Job Source", route: "job-sources", seed: "job-applications", referencingName: "Job Application" },
        { name: "Job Question", route: "job-questions", seed: "job-applications", referencingName: "Job Application" },
      ]) {
        test(`Entity: ${entity.name}`, async ({ page }, testInfo) => {
          const seeds = structuredClone(seedRecords[entity.seed]);
          if (entity.name === "Job Question") {
            const question = await callServer({ page, testInfo, route: "job-questions", method: "POST", data: seedRecords["job-questions"].primary.data });
            expect(question.status).toBe(201);
            seeds.primary.data.questions = [question.json];
          }
          const config = {
            name: entity.name,
            ...build_common_entity({ build_id: (segments: string[]) => build_tab_id([entity.route, ...segments]) }),
            seeds,
            assert: getTestAction(async ({ page, config }) => {
              const referencing = config.seeds.primary.created!;
              const targetId = getSeedTargetRecordId(config, referencing);
              const row = page.locator(config.recordId(targetId));
              await expect(row).toContainText("Referenced By");
              const target = `#db-viewer--${entity.seed}--container--record-${referencing.id}`;
              const link = row.locator(`a[href='${target}']`);
              await expect(link).toContainText(`${entity.referencingName} ${referencing.id}`);
              await clickDbViewerReferenceLink(link);
              await expect(page.locator(`#db-viewer--${entity.seed}--container`)).toHaveClass(/\bexpanded\b/);
              await expect(page.locator(target).locator(".expander").first()).toHaveClass(/\bexpanded\b/);
              await expectTransientHighlight(page.locator(target));
            }),
          };
          await runTest_entitiesLinkBackToReferencingEntities({ page, testInfo, config });
        });
      }

      async function runTest_entitiesLinkBackToReferencingEntities({
        page,
        testInfo,
        config,
      }: {
        page: Page;
        testInfo: TestInfo;
        config: LocalEntityConfig;
      }) {
        await seedTheDatabase({ page, testInfo, seeds: config.seeds });
        const targetRecordId = getSeedTargetRecordId(config, config.seeds.primary.created as Record<string, any>);

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();

        await page.locator(config.container()).scrollIntoViewIfNeeded();

        await expandSection({ page, config });

        const recordId = config.recordId(targetRecordId);

        const row = page.locator(recordId);

        await expect(row).toBeVisible();
        await expandRecordDetails({ page, config, entityId: targetRecordId });

        await config.assert({ page, config, testInfo });

        // const jobPostingRow = page.locator("#db-viewer--job-postings--record-9");
        // const referenceLink = jobPostingRow.locator("a[href='#db-viewer--ai-prompts--record-101']");

        // await expect(jobPostingRow).toContainText("Referenced By");
        // await expect(referenceLink).toContainText("AI Prompt 101 · Prompt 101");
        // await referenceLink.click();
        // await expect(page.locator("#db-viewer--ai-prompts--container")).toHaveAttribute("open", "");
        // await expect(page.locator("#db-viewer--ai-prompts--record-101")).toBeVisible();
      }

      function getSeedTargetRecordId(config: { name?: string }, created: Record<string, any> | undefined): number {
        if (!created) {
          throw new Error("Expected a seeded record for the incoming-reference test.");
        }

        const target = (() => {
          switch (config.name) {
            case "Job Posting":
              return created.jobPosting;
            case "Resume":
              return created.resume;
            case "AI Prompt Template":
              return created.aiPromptTemplate;
            case "AI Prompt":
              return created;
            case "Job Source":
              return created.source;
            case "Job Question":
              return created.questions[0];
            default:
              return created;
          }
        })();

        if (!target || typeof target.id !== "number" || target.id <= 0) {
          throw new Error(`Expected a valid seeded target record id for the ${config.name} incoming-reference test.`);
        }

        return target.id;
      }

      async function verifyBackReferenceWorks(page: Page, jobPostingRow: Locator, aiPrompt: { id: number; name: string }) {
        const referenceId = `#db-viewer--ai-prompts--container--record-${aiPrompt.id}`;
        const referenceLink = jobPostingRow.locator(`a[href='${referenceId}']`);
        await expect(referenceLink).toContainText(`AI Prompt ${aiPrompt.id} · ${aiPrompt.name}`);

        await clickDbViewerReferenceLink(referenceLink);

        await expect(page.locator("#db-viewer--ai-prompts--container")).toHaveClass(/\bexpanded\b/);
        await expect(page.locator(referenceId)).toBeVisible();

        const targetRow = page.locator(referenceId);
        const targetExpander = targetRow.locator(".expander").first();
        await expect(targetExpander).toHaveClass(/\bexpanded\b/);
      }

      async function clickDbViewerReferenceLink(locator: Locator) {
        await expect(locator).toBeVisible({ timeout: 10000 });
        await locator.scrollIntoViewIfNeeded();
        await locator.click({ timeout: 10000 });
      }
    });

    test.describe("Scenario Outline: Entity lists can refresh data", () => {
      type LocalEntityConfig = DbViewer.EntityConfig & {
        updateField: string;
        arrange: TestAction;
        assert: TestAction;
      };

      test("Entity: Job Posting", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Job Posting",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-postings", ...segments]),
          }),
          updateField: "title",

          seeds: seedRecords["job-postings"],
          arrange: getTestAction(arrange),
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkBackToReferencingEntities({ page, testInfo, config });
      });

      test("Entity: Resume", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "Resume",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["resumes", ...segments]),
          }),
          updateField: "name",

          seeds: seedRecords["resumes"],
          arrange: getTestAction(arrange),
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkBackToReferencingEntities({ page, testInfo, config });
      });

      test("Entity: AI Prompt Template", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "AI Prompt Template",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompt-templates", ...segments]),
          }),
          updateField: "name",

          seeds: seedRecords["ai-prompt-templates"],
          arrange: getTestAction(arrange),
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkBackToReferencingEntities({ page, testInfo, config });
      });

      test("Entity: AI Prompt", async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          name: "AI Prompt",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompts", ...segments]),
          }),
          updateField: "name",

          seeds: seedRecords["ai-prompts"],
          arrange: getTestAction(arrange),
          assert: getTestAction(assert),
        };

        await runTest_entitiesLinkBackToReferencingEntities({ page, testInfo, config });
      });

      async function runTest_entitiesLinkBackToReferencingEntities({
        page,
        testInfo,
        config,
      }: {
        page: Page;
        testInfo: TestInfo;
        config: LocalEntityConfig;
      }) {
        const entityId = await seedTheDatabase({ page, testInfo, seeds: config.seeds });

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();

        await page.locator(config.container()).scrollIntoViewIfNeeded();

        await expandSection({ page, config });

        const recordId = config.recordId(entityId);
        const row = page.locator(recordId);
        await expect(row).toBeVisible();

        const refreshButton = page.locator(config.controlId("refresh-button"));
        await expect(refreshButton).toBeVisible();

        await config.arrange({ page, config, testInfo });

        await refreshButton.click();

        await config.assert({ page, config, testInfo });
      }

      async function arrange({ page, config, buildEditorDisplayVerifier, testInfo }: InternalTestActionParams) {
        const original = config.seeds.primary.data;
        const record = config.seeds.primary.created;

        if (!record) {
          throw new Error("Initial record not created.");
        }

        if (!record.id) {
          throw new Error("Initial record ID not available.");
        }

        await expandRecordDetails({ page, config, entityId: record.id });

        const verify = buildEditorDisplayVerifier({ page, config, original, record });
        await verify("id", record.id.toString());
        await verify((config as LocalEntityConfig).updateField);

        // simulate a change from another user, by updating the name field directly to the server
        const data = {
          [`${(config as LocalEntityConfig).updateField}`]: `${original[(config as LocalEntityConfig).updateField]} :: Updated`,
        };
        const response = await callServer({
          page,
          testInfo,
          route: `${config.seeds.primary.route}/${record.id}`,
          method: "PATCH",
          data,
        });

        await expect(response.ok, "Failed to update the record on the server.").toBe(true);
      }

      async function assert({ page, config, buildEditorDisplayVerifier }: InternalTestActionParams) {
        const original = config.seeds.primary.data;
        const record = config.seeds.primary.created;

        if (!record?.id) {
          throw new Error("Initial record ID not available.");
        }

        const row = page.locator(config.recordId(record.id));
        await expect(row).toBeVisible();
        await expandRecordDetails({ page, config, entityId: record.id });

        const verify = buildEditorDisplayVerifier({ page, config, original, record });
        await verify("id", record.id.toString());
        await verify((config as LocalEntityConfig).updateField, `${original[(config as LocalEntityConfig).updateField]} :: Updated`);
      }
    });

    test.describe("Scenario Outline: Enumerated fields are rendered as dropdowns in edit forms", () => {
      test("Entity: Job Posting", async ({ page }, testInfo) => {
        const config = {
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-postings", ...segments]),
          }),
          seeds: seedRecords["job-postings"],
        };

        await seedTheDatabase({ page, testInfo, seeds: config.seeds });
        const record = config.seeds.primary.created;

        if (!record?.id) {
          throw new Error("Initial record ID not available.");
        }

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();
        await page.locator(config.container()).scrollIntoViewIfNeeded();
        await expandSection({ page, config });
        await expandRecordDetails({ page, config, entityId: record.id });
        await page.locator(config.editButtonId(record.id)).click();

        const workModelField = page.locator(buildEditorFieldId({ page, config, testInfo, field: "work-model", recordId: record.id }));
        await expect(workModelField).toBeVisible();
        await expect(workModelField).toHaveJSProperty("tagName", "SELECT");
        await expect(workModelField).toHaveValue("Remote");

        const workModelOptions = await workModelField.locator("option").allTextContents();
        expect(workModelOptions).toEqual(expect.arrayContaining(["Unknown", "Remote", "InOffice", "Hybrid"]));
      });

      test("Entity: Job Application", async ({ page }, testInfo) => {
        const config = {
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-applications", ...segments]),
          }),
          seeds: seedRecords["job-applications"],
        };

        await seedTheDatabase({ page, testInfo, seeds: config.seeds });
        const record = config.seeds.primary.created;

        if (!record?.id) {
          throw new Error("Initial record ID not available.");
        }

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();
        await page.locator(config.container()).scrollIntoViewIfNeeded();
        await expandSection({ page, config });
        await expandRecordDetails({ page, config, entityId: record.id });
        await page.locator(config.editButtonId(record.id)).click();

        const statusField = page.locator(buildEditorFieldId({ page, config, testInfo, field: "status", recordId: record.id }));
        await expect(statusField).toBeVisible();
        await expect(statusField).toHaveJSProperty("tagName", "SELECT");
        await expect(statusField).toHaveValue("Draft");

        const statusOptions = await statusField.locator("option").allTextContents();
        expect(statusOptions).toEqual(
          expect.arrayContaining([
            "Unknown",
            "Draft",
            "Saved",
            "Applied",
            "Interviewing",
            "Offer",
            "Accepted",
            "Rejected",
            "Withdrawn",
            "Ghosted",
            "Other",
          ]),
        );
      });
    });

    test.describe("Scenario Outline: Entities are editable", () => {
      type LocalEntityConfig = DbViewer.EntityConfig & {
        actions: TestActions;
        updateRoute: (id: number) => string;
      };

      test(`Entity: Job Posting`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-postings", ...segments]),
          }),
          updateRoute: (id: number) => `/api/v1/job-postings/${id}`,
          seeds: seedRecords["job-postings"],
          actions: getTestActions(arrange, act, assert),
        };

        await runTest_editWorkflow({ page, testInfo, config });

        async function arrange({ page, config, buildEditorVerifier }: InternalTestActionParams) {
          const original = config.seeds.primary.data;
          const record = config.seeds.primary.created;

          if (!record) {
            throw new Error("Initial record not created.");
          }

          if (!record.id) {
            throw new Error("Initial record ID not available.");
          }

          await expandRecordDetails({ page, config, entityId: record.id });

          const verify = buildEditorVerifier({ page, config, original, record });
          await verify("id", record.id.toString());
          await verify("title");
          await verify("company");
          await verify("location");
          await verify("salary");
          await verify("work-model", original.workModel);
          await verify("url");
          await verify("document--type", original.document?.type);
          await verify("document--content", original.document?.content);
        }

        async function act({ page, config, buildEditorFieldId, setEditorFieldValue }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          await setEditorFieldValue({ field: "title", recordId: record.id, value: "Staff Platform Engineer" });
          await setEditorFieldValue({ field: "company", recordId: record.id, value: "Fabrikam" });
          await setEditorFieldValue({ field: "location", recordId: record.id, value: "Austin, TX" });
          await setEditorFieldValue({ field: "salary", recordId: record.id, value: "$175,000" });
          await setEditorFieldValue({ field: "work-model", recordId: record.id, value: "Hybrid" });
          await setEditorFieldValue({ field: "url", recordId: record.id, value: "https://example.com/job/platform" });
          await setEditorFieldValue({ field: "document--type", recordId: record.id, value: "html" });
          await setEditorFieldValue({ field: "document--content", recordId: record.id, value: "<h1>Staff Platform Engineer</h1>" });

          // scroll the cancel button to the top of the screen, to test that the record is scrolled back into the screen
          await page.locator(config.cancelButtonId(record?.id)).scrollIntoViewIfNeeded();
        }

        async function assert({ page, config, buildEditorFieldId, buildEditorDisplayVerifier }: InternalTestActionParams) {
          const original = config.seeds.primary.data;
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          await expandRecordDetails({ page, config, entityId: record.id });

          const verifyDisplay = buildEditorDisplayVerifier({ page, config, original, record });
          await verifyDisplay("title", "Staff Platform Engineer");
          await verifyDisplay("company", "Fabrikam");
          await verifyDisplay("location", "Austin, TX");
          await verifyDisplay("salary", "$175,000");
          await verifyDisplay("work-model", "Hybrid");
          await verifyDisplay("url", "https://example.com/job/platform");
          await verifyDisplay("document--display--type", "html");
          await verifyDisplay("document--display--content", "<h1>Staff Platform Engineer</h1>");

          await expandRecordDetails({ page, config, entityId: record.id });

          await expect(page.locator(config.editButtonId(record.id))).toBeVisible();
        }
      });

      test(`Entity: Resume`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["resumes", ...segments]),
          }),
          updateRoute: (id: number) => `/api/v1/resumes/${id}`,
          seeds: seedRecords["resumes"],
          actions: getTestActions(arrange, act, assert),
        };

        await runTest_editWorkflow({ page, testInfo, config });

        async function arrange({ page, config, buildEditorVerifier }: InternalTestActionParams) {
          const original = config.seeds.primary.data;
          const record = config.seeds.primary.created;

          if (!record) {
            throw new Error("Initial record not created.");
          }

          if (!record.id) {
            throw new Error("Initial record ID not available.");
          }

          await expandRecordDetails({ page, config, entityId: record.id });

          const verify = buildEditorVerifier({ page, config, original, record });
          await verify("id", record.id.toString());
          await verify("name");
          await verify("job-title", original.jobTitle);
          await verify("date");
          await verify("document--type", original.document?.type);
          await verify("document--content", original.document?.content);
        }

        async function act({ page, config, buildEditorFieldId, setEditorFieldValue }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          await setEditorFieldValue({ field: "name", recordId: record.id, value: "Platform Resume" });
          await setEditorFieldValue({ field: "job-title", recordId: record.id, value: "Staff Platform Engineer" });
          await setEditorFieldValue({ field: "date", recordId: record.id, value: "2026-02-20" });
          await setEditorFieldValue({ field: "document--type", recordId: record.id, value: "html" });
          await setEditorFieldValue({ field: "document--content", recordId: record.id, value: "<h1>Platform Resume</h1>" });

          // scroll the cancel button to the top of the screen, to test that the record is scrolled back into the screen
          await page.locator(config.cancelButtonId(record?.id)).scrollIntoViewIfNeeded();
        }

        async function assert({ page, config, buildEditorFieldId, buildEditorDisplayVerifier }: InternalTestActionParams) {
          const original = config.seeds.primary.data;
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          await expandRecordDetails({ page, config, entityId: record.id });

          const verifyDisplay = buildEditorDisplayVerifier({ page, config, original, record });
          await verifyDisplay("name", "Platform Resume");
          await verifyDisplay("job-title", "Staff Platform Engineer");
          await verifyDisplay("date", "2026-02-20");
          await verifyDisplay("document--display--type", "html");
          await verifyDisplay("document--display--content", "<h1>Platform Resume</h1>");

          await expandRecordDetails({ page, config, entityId: record.id });

          await expect(page.locator(config.editButtonId(record.id))).toBeVisible();
        }
      });

      test(`Entity: AI Prompt Template`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompt-templates", ...segments]),
          }),
          updateRoute: (id: number) => `/api/v1/ai-prompt-templates/${id}`,
          seeds: seedRecords["ai-prompt-templates"],
          actions: getTestActions(arrange, act, assert),
        };

        await runTest_editWorkflow({ page, testInfo, config });

        async function arrange({ page, config, buildEditorVerifier }: InternalTestActionParams) {
          const original = config.seeds.primary.data;
          const record = config.seeds.primary.created;

          if (!record) {
            throw new Error("Initial record not created.");
          }

          if (!record.id) {
            throw new Error("Initial record ID not available.");
          }

          await expandRecordDetails({ page, config, entityId: record.id });

          const verify = buildEditorVerifier({ page, config, original, record });
          await verify("id", record.id.toString());
          await verify("name");
          await verify("document--type", original.document?.type);
          await verify("document--content", original.document?.content);
        }

        async function act({ page, config, buildEditorFieldId, setEditorFieldValue }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          await setEditorFieldValue({ field: "name", recordId: record.id, value: "Platform Interview Template" });
          await setEditorFieldValue({ field: "document--type", recordId: record.id, value: "html" });
          await setEditorFieldValue({
            field: "document--content",
            recordId: record.id,
            value: "<h1>Assess the candidate's platform engineering experience.</h1>",
          });

          // scroll the cancel button to the top of the screen, to test that the record is scrolled back into the screen
          await page.locator(config.cancelButtonId(record?.id)).scrollIntoViewIfNeeded();
        }

        async function assert({ page, config, buildEditorFieldId, buildEditorDisplayVerifier }: InternalTestActionParams) {
          const original = config.seeds.primary.data;
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          await expandRecordDetails({ page, config, entityId: record.id });

          const verifyDisplay = buildEditorDisplayVerifier({ page, config, original, record });
          await verifyDisplay("name", "Platform Interview Template");
          await verifyDisplay("document--display--type", "html");
          await verifyDisplay("document--display--content", "<h1>Assess the candidate's platform engineering experience.</h1>");

          await expandRecordDetails({ page, config, entityId: record.id });

          await expect(page.locator(config.editButtonId(record.id))).toBeVisible();
        }
      });

      test(`Entity: AI Prompt`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompts", ...segments]),
          }),
          updateRoute: (id: number) => `/api/v1/ai-prompts/${id}`,
          seeds: seedRecords["ai-prompts"],
          actions: getTestActions(arrange, act, assert),
        };

        await runTest_editWorkflow({ page, testInfo, config });

        async function arrange({
          page,
          config,
          testInfo,
          buildEditorVerifier,
          buildEditorDisplayVerifier,
          verifyEditorDisplayField,
        }: InternalTestActionParams) {
          const original = config.seeds.primary.data;
          const record = config.seeds.primary.created;

          if (!record) {
            throw new Error("Initial record not created.");
          }

          if (!record.id) {
            throw new Error("Initial record ID not available.");
          }

          await expandRecordDetails({ page, config, entityId: record.id });

          const verify = buildEditorVerifier({ page, config, original, record });
          const aiPromptRecord = record as EntityRecord & {
            jobPostingId?: number;
            resumeId?: number;
            aiPromptTemplateId?: number;
          };

          await verify("id", record.id.toString());
          await verify("name");
          await verify("ai-url", original.aiUrl);
          await verify("job-posting--id", String(aiPromptRecord.jobPostingId));
          await verify("resume--id", String(aiPromptRecord.resumeId));
          await verify("ai-prompt-template--id", String(aiPromptRecord.aiPromptTemplateId));

          await verifyEditorDisplayField({
            page,
            config,
            testInfo,
            field: "job-posting--display--title",
            recordId: aiPromptRecord.jobPostingId!,
            expectedValue: original.jobPosting?.title,
          });
          await verifyEditorDisplayField({
            page,
            config,
            testInfo,
            field: "job-posting--display--company",
            recordId: aiPromptRecord.jobPostingId!,
            expectedValue: original.jobPosting?.company,
          });
          await verifyEditorDisplayField({
            page,
            config,
            testInfo,
            field: "job-posting--display--work-model",
            recordId: aiPromptRecord.jobPostingId!,
            expectedValue: original.jobPosting?.workModel,
          });
          await verifyEditorDisplayField({
            page,
            config,
            testInfo,
            field: "job-posting--display--salary",
            recordId: aiPromptRecord.jobPostingId!,
            expectedValue: original.jobPosting?.salary,
          });
        }

        async function act({ page, config, setEditorFieldValue }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const alternateJobPosting = config.seeds.alternateJobPosting.created;
          const alternateResume = config.seeds.alternateResume.created;
          const alternateAiPromptTemplate = config.seeds.alternateAiPromptTemplate.created;

          if (!alternateJobPosting?.id || !alternateResume?.id || !alternateAiPromptTemplate?.id) {
            throw new Error("Alternate relationship record IDs not available.");
          }

          await setEditorFieldValue({ field: "name", recordId: record.id, value: "Platform Fit Analysis" });
          await setEditorFieldValue({ field: "ai-url", recordId: record.id, value: "https://copilot.microsoft.com" });
          await setEditorFieldValue({ field: "job-posting--id", recordId: record.id, value: String(alternateJobPosting.id) });
          await setEditorFieldValue({ field: "resume--id", recordId: record.id, value: String(alternateResume.id) });
          await setEditorFieldValue({
            field: "ai-prompt-template--id",
            recordId: record.id,
            value: String(alternateAiPromptTemplate.id),
          });

          // scroll the cancel button to the top of the screen, to test that the record is scrolled back into the screen
          await page.locator(config.cancelButtonId(record?.id)).scrollIntoViewIfNeeded();
        }

        async function assert({
          page,
          config,
          buildEditorFieldId,
          buildEditorDisplayVerifier,
          verifyEditorDisplayField,
        }: InternalTestActionParams) {
          const original = config.seeds.primary.data;
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          await expandRecordDetails({ page, config, entityId: record.id });

          const verifyDisplay = buildEditorDisplayVerifier({ page, config, original, record });
          const alternateJobPosting = config.seeds.alternateJobPosting;
          const alternateResume = config.seeds.alternateResume;
          const alternateAiPromptTemplate = config.seeds.alternateAiPromptTemplate;

          await verifyDisplay("name", "Platform Fit Analysis");
          await verifyDisplay("ai-url", "https://copilot.microsoft.com");
          // await verifyDisplay("job-posting--display--id", String(alternateJobPosting.created!.id));
          await verifyEditorDisplayField({
            field: "job-posting--display--id",
            recordId: alternateJobPosting.created!.id!,
            expectedValue: String(alternateJobPosting.created!.id),
          });
          await verifyEditorDisplayField({
            field: "resume--display--id",
            recordId: alternateResume.created!.id!,
            expectedValue: String(alternateResume.created!.id),
          });
          await verifyEditorDisplayField({
            field: "ai-prompt-template--display--id",
            recordId: alternateAiPromptTemplate.created!.id!,
            expectedValue: String(alternateAiPromptTemplate.created!.id),
          });

          const verifyDisplay_jp = buildEditorDisplayVerifier({
            page,
            config,
            original: alternateJobPosting.data,
            record: alternateJobPosting.created as EntityRecord,
          });
          await verifyDisplay_jp("job-posting--display--title", alternateJobPosting.data.title);
          await verifyDisplay_jp("job-posting--display--company", alternateJobPosting.data.company);
          await verifyDisplay_jp("job-posting--display--work-model", alternateJobPosting.data.workModel);
          await verifyDisplay_jp("job-posting--display--salary", alternateJobPosting.data.salary);

          await verifyEditorDisplayField({
            field: "resume--display--name",
            recordId: alternateResume.created!.id!,
            expectedValue: alternateResume.data.name,
          });
          await verifyEditorDisplayField({
            field: "ai-prompt-template--display--name",
            recordId: alternateAiPromptTemplate.created!.id!,
            expectedValue: alternateAiPromptTemplate.data.name,
          });

          await expandRecordDetails({ page, config, entityId: record.id });

          await expect(page.locator(config.editButtonId(record.id))).toBeVisible();
        }
      });

      async function runTest_editWorkflow({ page, testInfo, config }: { page: Page; testInfo: TestInfo; config: LocalEntityConfig }) {
        const entityId = await seedTheDatabase({ page, testInfo, seeds: config.seeds });

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();

        await page.locator(config.container()).scrollIntoViewIfNeeded();

        await expandSection({ page, config });

        // make sure that the created record is visible
        const recordRow = page.locator(config.recordId(entityId));
        await expect(recordRow).toBeVisible({ timeout: 3000 });
        await expandRecordDetails({ page, config, entityId });

        // validate that the form and action buttons are in the correct pre-edit state
        await expect(page.locator(config.formId())).not.toBeVisible();
        await expect(page.locator(config.saveButtonId(entityId))).not.toBeVisible();
        await expect(page.locator(config.cancelButtonId(entityId))).not.toBeVisible();
        await expect(page.locator(config.editButtonId(entityId))).toBeVisible();

        const editButtonId = config.editButtonId(entityId);
        const editButtonLocator = page.locator(editButtonId);
        await expect(editButtonLocator).toHaveCount(1);
        await expect(editButtonLocator).toBeVisible({ timeout: 3000 });
        await editButtonLocator.click();

        await expect(page.locator(config.formId())).toBeVisible();
        const saveButton = page.locator(config.saveButtonId(entityId));
        await expect(saveButton).toBeVisible();
        await expect(saveButton).toHaveClass(/button--primary/);
        await expect(page.locator(config.cancelButtonId(entityId))).toBeVisible();

        if (config.actions.arrange) {
          await config.actions.arrange({ page, config, testInfo });
        }

        if (config.actions.act) {
          await config.actions.act({ page, config, testInfo });
        }

        const saveRequest = page.waitForRequest((request) => {
          const url = config.updateRoute(entityId);
          return request.method() === "PATCH" && request.url().endsWith(url) && request.postData() !== null;
        });

        const saveResponse = page.waitForResponse((response) => {
          const url = config.updateRoute(entityId);
          return response.request().method() === "PATCH" && response.url().endsWith(url);
        });

        await page.locator(config.saveButtonId(entityId)).click();

        await saveRequest;
        const response = await saveResponse;
        expect(response.ok(), await response.text()).toBeTruthy();

        if (config.actions.assert) {
          await expect(page.locator(config.formId())).not.toBeVisible();
          await config.actions.assert({ page, config, testInfo });
        }

        // validate that the form and action buttons are in the correct post-edit state
        await expect(page.locator(config.formId())).not.toBeVisible();
        await expect(page.locator(config.saveButtonId(entityId))).not.toBeVisible();
        await expect(page.locator(config.cancelButtonId(entityId))).not.toBeVisible();
        await expect(page.locator(config.editButtonId(entityId))).toBeVisible();
      }
    });

    test.describe("Scenario Outline: Documents are editable", () => {
      type LocalEntityConfig = DbViewer.EntityConfig & {
        updateRoute: (id: number) => string;
        documentProperty?: "document" | "promptDocument" | "responseDocument";
      };

      test(`Entity: Job Posting`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-postings", ...segments]),
          }),
          updateRoute: (id: number) => `/api/v1/job-postings/${id}`,
          seeds: seedRecords["job-postings"],
        };

        await runTest_editDocumentWorkflow({ page, testInfo, config });
      });

      test(`Entity: Resume`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["resumes", ...segments]),
          }),
          updateRoute: (id: number) => `/api/v1/resumes/${id}`,
          seeds: seedRecords["resumes"],
        };

        await runTest_editDocumentWorkflow({ page, testInfo, config });
      });

      test(`Entity: AI Prompt Template`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompt-templates", ...segments]),
          }),
          updateRoute: (id: number) => `/api/v1/ai-prompt-templates/${id}`,
          seeds: seedRecords["ai-prompt-templates"],
        };

        await runTest_editDocumentWorkflow({ page, testInfo, config });
      });

      for (const documentProperty of ["promptDocument", "responseDocument"] as const) {
        test(`Entity: AI Prompt ${documentProperty === "promptDocument" ? "Prompt Document" : "Response Document"}`, async ({ page }, testInfo) => {
          const config = {
            ...build_common_entity({ build_id: (segments: string[]) => build_tab_id(["ai-prompts", ...segments]) }),
            updateRoute: (id: number) => `/api/v1/ai-prompts/${id}`,
            seeds: seedRecords["ai-prompts"],
            documentProperty,
          };
          await runTest_editDocumentWorkflow({ page, testInfo, config });
        });
      }

      async function runTest_editDocumentWorkflow({
        page,
        testInfo,
        config,
      }: {
        page: Page;
        testInfo: TestInfo;
        config: LocalEntityConfig;
      }) {
        const entityId = await seedTheDatabase({ page, testInfo, seeds: config.seeds });

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();

        await page.locator(config.container()).scrollIntoViewIfNeeded();
        await expandSection({ page, config });

        const recordRow = page.locator(config.recordId(entityId));
        await expect(recordRow).toBeVisible({ timeout: 3000 });

        const editButton = page.locator(config.editButtonId(entityId));
        await expect(editButton).toBeVisible();
        await editButton.click();

        await expect(page.locator(config.formId())).toBeVisible();
        const saveButton = page.locator(config.saveButtonId(entityId));
        await expect(saveButton).toBeVisible();

        const original = config.seeds.primary.data;
        const record = config.seeds.primary.created;
        const documentProperty = config.documentProperty ?? "document";
        const documentField = documentProperty.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

        if (!record) {
          throw new Error("Initial record not created.");
        }

        if (!record.id) {
          throw new Error("Initial record ID not available.");
        }

        const verify = buildEditorVerifier({ page, config, testInfo, original, record });
        await verify(`${documentField}--type`, original[documentProperty]?.type);
        await verify(`${documentField}--content`, original[documentProperty]?.content);

        await setEditorFieldValue({ page, config, testInfo, field: `${documentField}--type`, recordId: record.id, value: "html" });

        const updatedDocumentContent = `<h1>${config.seeds.primary.name} updated</h1>`;
        await setEditorFieldValue({
          page,
          config,
          testInfo,
          field: `${documentField}--content`,
          recordId: record.id,
          value: updatedDocumentContent,
        });

        await page.locator(config.cancelButtonId(record.id)).scrollIntoViewIfNeeded();

        const saveRequest = page.waitForRequest((request) => {
          const url = config.updateRoute(entityId);
          return request.method() === "PATCH" && request.url().endsWith(url) && request.postData() !== null;
        });

        const saveResponse = page.waitForResponse((response) => {
          const url = config.updateRoute(entityId);
          return response.request().method() === "PATCH" && response.url().endsWith(url);
        });

        await saveButton.click();
        const request = await saveRequest;
        expect(request.postDataJSON()).toEqual({
          [documentProperty]: { id: record[documentProperty].id, type: "HTML", content: updatedDocumentContent },
        });
        const response = await saveResponse;
        expect(response.ok(), await response.text()).toBeTruthy();

        const verifyDisplay = buildEditorDisplayVerifier({ page, config, testInfo, original, record });
        await expect(page.locator(config.formId())).not.toBeVisible();
        await verifyDisplay(`${documentField}--display--type`, "html");
        await verifyDisplay(`${documentField}--display--content`, updatedDocumentContent);

        await expect(page.locator(config.formId())).not.toBeVisible();
        await expect(page.locator(config.editButtonId(entityId))).toBeVisible();
      }
    });

    test.describe("Scenario Outline: Entity edits can be cancelled", () => {
      type LocalEntityConfig = EntityConfig & {
        editField: string;
        editFieldObjectKey: string;
        summaryFieldObjectKey: string;
      };

      test(`Entity: Job Posting`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          entity: "Job Posting",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-postings", ...segments]),
          }),
          editField: "title",
          editFieldObjectKey: "title",
          summaryFieldObjectKey: "title",

          seeds: seedRecords["job-postings"],
        };

        await runTest_cancelEditMode({ page, testInfo, config });
      });

      test(`Entity: Resume`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          entity: "Resume",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["resumes", ...segments]),
          }),
          editField: "job-title",
          editFieldObjectKey: "jobTitle",
          summaryFieldObjectKey: "name",

          seeds: seedRecords["resumes"],
        };

        await runTest_cancelEditMode({ page, testInfo, config });
      });

      test(`Entity: AI Prompt Template`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          entity: "AI Prompt Template",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompt-templates", ...segments]),
          }),
          editField: "name",
          editFieldObjectKey: "name",
          summaryFieldObjectKey: "name",

          seeds: seedRecords["ai-prompt-templates"],
        };

        await runTest_cancelEditMode({ page, testInfo, config });
      });

      test(`Entity: AI Prompt`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          entity: "AI Prompt",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["ai-prompts", ...segments]),
          }),
          editField: "name",
          editFieldObjectKey: "name",
          summaryFieldObjectKey: "name",

          seeds: seedRecords["ai-prompts"],
        };

        await runTest_cancelEditMode({ page, testInfo, config });
      });

      async function runTest_cancelEditMode({ page, testInfo, config }: { page: Page; testInfo: TestInfo; config: LocalEntityConfig }) {
        const entityId = await seedTheDatabase({ page, testInfo, seeds: config.seeds });

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();

        await expandSection({ page, config });

        await page.locator(config.editButtonId(entityId)).click();
        await expect(page.locator(config.formId())).toBeVisible();
        await expect(page.locator(config.cancelButtonId(entityId))).toBeVisible();

        const editFieldId = buildEditorFieldId({ page, config, field: config.editField, recordId: entityId });
        const editValue = config.seeds.primary.created![config.editFieldObjectKey];
        const summaryValue = config.seeds.primary.created![config.summaryFieldObjectKey];
        await page.locator(editFieldId).fill(editValue + " :: Updated");

        await page.locator(config.cancelButtonId(entityId)).click();

        await expect(page.locator(config.formId())).not.toBeVisible();
        await expandRecordDetails({ page, config, entityId });
        const summary = page.locator(config.recordId(entityId)).locator(".expander > .header > .title").first();
        await expect(summary).toContainText(String(summaryValue));
        await expect(summary).not.toContainText(editValue + " :: Updated");
        const persisted = await page.request.get(`http://localhost:5000/api/v1/${config.seeds.primary.route}/${entityId}`, {
          headers: getTestHeaders(testInfo),
        });
        expect(persisted.ok()).toBeTruthy();
        expect((await persisted.json())[config.editFieldObjectKey]).toBe(editValue);
      }
    });
  });

  /*****************************************************
   * Helpers
   *****************************************************/

  export type EntityConfig = {
    name?: string;
    buildId: (args: string[]) => string;
    recordId: (id: number) => string;
    editButtonId: (id: number) => string;
    saveButtonId: (id: number) => string;
    cancelButtonId: (id: number) => string;
    container: () => string;
    formId: () => string;
    controlId: (controlName: string) => string;
    recordControlId: (id: number, controlName: string) => string;
    seeds: EntitySeedDictionary;
  };

  export type EntityRecordData = Record<string, any>;
  export type EntityRecord = EntityRecordData & { id: number };
  export type EntitySeed = { name: string; route: string; data: EntityRecordData; created?: EntityRecord };
  export type EntitySeedDictionary = Record<string, EntitySeed>;

  export type PageConfigParams = { page: Page; config: EntityConfig; testInfo: TestInfo };
  type BuildEditorFieldIdParams = { field: string; recordId: number };

  type TestAction = (params: PageConfigParams) => Promise<void>;
  type TestActions = {
    arrange: TestAction;
    act: TestAction;
    assert: TestAction;
  };
  type VerifyFieldParams = { elementId: string; expectedValue: string };
  type VerifyEditorFieldParams = { field: string; recordId: number; expectedValue: string };
  type SetEditorFieldValueParams = { field: string; recordId: number; value: string };
  type BuildKnownVerifierParams = PageConfigParams & { original: Record<string, any>; record: EntityRecord };
  type SimpleEditorVerifierFunction = (field: string, value?: string) => Promise<void>;
  type SimpleDisplayVerifierFunction = (params: { elementId: string; field?: string; value?: string }) => Promise<void>;

  export type InternalTestActionVerifierParams = {
    buildEditorFieldId: (params: BuildEditorFieldIdParams) => string;
    verifyField: (params: VerifyFieldParams) => Promise<void>;
    verifyEditorField: (params: VerifyEditorFieldParams & Partial<PageConfigParams>) => Promise<void>;
    verifyEditorDisplayField: (params: VerifyEditorFieldParams & Partial<PageConfigParams>) => Promise<void>;
    setEditorFieldValue: (params: SetEditorFieldValueParams) => Promise<void>;
    buildEditorDisplayVerifier: (params: Omit<BuildKnownVerifierParams, "testInfo">) => SimpleEditorVerifierFunction;
    buildEditorVerifier: (params: Omit<BuildKnownVerifierParams, "testInfo">) => SimpleEditorVerifierFunction;
  };
  export type InternalTestActionParams = PageConfigParams & InternalTestActionVerifierParams;
  type InternalTestAction = (params: InternalTestActionParams) => Promise<void>;

  function build_common_entity({ build_id }: { build_id: (segments: string[]) => string }) {
    const section = build_id(["container"]);
    const record = (id: number) => `${section}--record-${id}`;
    const result = {
      buildId: build_id,
      container: () => build_id(["container"]),
      recordId: (id: number) => build_id(["container", build_record_id(id)]),
      editButtonId: (id: number) => `${record(id)} button:text-is("Edit")`,
      formId: () => `${section} [id^='entity-editor-']`,
      saveButtonId: (id: number) => `${record(id)} [id^='entity-editor-'] > .header button:text-is("Save")`,
      cancelButtonId: (id: number) => `${record(id)} [id^='entity-editor-'] > .header button:text-is("Cancel")`,
      controlId: (controlName: string) => controlName === "count" ? `${section} > .header .count`
        : controlName === "list" ? `${section} ul.data-list`
        : controlName === "refresh-button" ? `${section} > .header button:text-is("Refresh")`
        : build_id([controlName]),
      recordControlId: (id: number, controlName: string) => build_id([controlName, `record-${id}`]),
    };
    return result;
  }

  function getTestActions(arrange: InternalTestAction, act: InternalTestAction, assert: InternalTestAction): TestActions {
    return {
      arrange: getTestAction(arrange),
      act: getTestAction(act),
      assert: getTestAction(assert),
    };
  }

  function getTestAction(callback: InternalTestAction): TestAction {
    return action;

    async function action({ page, config, testInfo }: PageConfigParams) {
      await callback({
        page,
        config,
        testInfo,
        buildEditorFieldId: (params) => buildEditorFieldId({ page, config, testInfo, ...params }),
        verifyField: (params) => verifyField({ page, config, testInfo, ...params }),
        verifyEditorField: (params) => verifyEditorField({ page, config, testInfo, ...params }),
        verifyEditorDisplayField: (params) => verifyEditorDisplayField({ page, config, testInfo, ...params }),
        buildEditorVerifier: (params) => buildEditorVerifier({ ...params, testInfo }),
        buildEditorDisplayVerifier: (params) => buildEditorDisplayVerifier({ ...params, testInfo }),
        setEditorFieldValue: (params) => setEditorFieldValue({ page, config, testInfo, ...params }),
      });
    }
  }

  function build_id(segments: string[]) {
    return `#${segments.join("--")}`;
  }

  function build_tab_id(segments: string[]) {
    return build_id(["db-viewer", ...segments]);
  }

  function build_record_id(id: number) {
    return `record-${id}`;
  }

  function fieldLabel(field: string) {
    if (field === "applied-on-date") {
      return "Applied On";
    }
    if (field === "url") {
      return "URL";
    }

    return field
      .split(/-+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function buildEditorFieldId({
    config,
    field,
    recordId,
  }: Omit<PageConfigParams, "testInfo"> & { testInfo?: TestInfo } & BuildEditorFieldIdParams) {
    const editor = `${config.recordId(recordId)} [id^='entity-editor-']`;
    const documentField = field.split("--")[0];
    if (["document", "prompt-document", "response-document"].includes(documentField)) {
      const scope = documentField === "document" ? "" : `.field-editor.${documentField.replace("-document", "")}--field`;
      return `${editor} ${scope} .document--editor.embedded .field-editor.${field.slice(documentField.length + 2)} :is(input, textarea, select)`;
    }
    return `${editor} .field-editor.${field.replace(/--/g, "-")} :is(input, textarea, select)`;
  }

  function buildEditorVerifier({ page, config, testInfo, original, record }: BuildKnownVerifierParams): SimpleEditorVerifierFunction {
    return verify;

    async function verify(field: string, value?: string) {
      if (!record?.id) {
        throw new Error("Record ID is missing");
      }

      const expectedValue = value || original[field];
      await verifyEditorField({ page, config, testInfo, field, recordId: record.id, expectedValue });
    }
    // return buildVerifier({ original, record, verifier: verifyEditorField });
  }

  function buildEditorDisplayVerifier({
    page,
    config,
    testInfo,
    original,
    record,
  }: BuildKnownVerifierParams): SimpleEditorVerifierFunction {
    return verify;

    // async function verify(field: string, value?: string) {
    //   const expectedValue = value || original[field];
    //   await verifyEditorDisplayField({ field, recordId: record.id, expectedValue });
    // }

    async function verify(field: string, value?: string) {
      if (!record?.id) {
        throw new Error("Record ID is missing");
      }

      const expectedValue = value ?? original[field];
      await verifyEditorDisplayField({ page, config, testInfo, field, recordId: record.id, expectedValue });
    }
    // return buildVerifier({ original, record, verifier: verifyDisplayField });
  }

  async function verifyField({ page, config, elementId, expectedValue }: PageConfigParams & VerifyFieldParams) {
    const locator = page.locator(elementId);
    await expect(locator).toHaveCount(1);
    const value = await locator.inputValue();
    return await expect(value).toBe(expectedValue);
  }

  async function verifyEditorField({ page, config, testInfo, field, recordId, expectedValue }: PageConfigParams & VerifyEditorFieldParams) {
    const elementId = buildEditorFieldId({ page, config, testInfo, field, recordId });
    const locator = page.locator(elementId);
    await expect(locator).toHaveCount(1);
    await expect(locator).toHaveValue(field.endsWith("--type") ? documentType(expectedValue) : expectedValue);
  }

  async function verifyDisplayField({ page, config, testInfo, elementId, expectedValue }: PageConfigParams & VerifyFieldParams) {
    const locator = page.locator(elementId);
    await expect(locator).toHaveCount(1);
    const value = await locator.textContent();
    return await expect(value).toBe(expectedValue);
  }

  async function verifyEditorDisplayField({
    page,
    config,
    testInfo,
    field,
    recordId,
    expectedValue,
  }: PageConfigParams & VerifyEditorFieldParams) {
    const row = page.locator(config.recordId(config.seeds.primary.created!.id));
    await expandRecordDetails({ page, config, entityId: config.seeds.primary.created!.id });
    const documentField = field.split("--")[0];
    const isDocument = ["document", "prompt-document", "response-document"].includes(documentField);
    const documentScope = isDocument && documentField !== "document" ? row.locator(`.entity-reference.${documentField}`) : row;
    if (isDocument) {
      const document = documentScope.locator("[id^='entity-display-document-display--']").first();
      if (!(await document.evaluate((element) => element.classList.contains("expanded")))) {
        await document.locator("> .header > .title").click();
      }
    }
    const parts = field.split("--display--");
    const scope = parts.length > 1 && !isDocument ? row.locator(`.entity-reference.${parts[0]}`) : documentScope;
    if (parts.length > 1 && !isDocument) {
      const reference = scope.locator(".expander").first();
      if (!(await reference.evaluate((element) => element.classList.contains("expanded")))) {
        await reference.locator("> .header > .title").click();
      }
    }
    const fieldName = parts.length > 1 ? parts[1] : field;
    const selector = isDocument ? `.document-${fieldName}` : `.value.${fieldName}`;
    const expected = field.endsWith("--type") ? documentType(expectedValue)
      : expectedValue;
    await expect(scope.locator(selector).first()).toHaveText(expected);
  }

  async function expectTransientHighlight(locator: Locator, timeoutMs = 5000) {
    await expect
      .poll(async () => await locator.evaluate((element) => element.classList.contains("db-viewer-list-item--highlight")), {
        timeout: timeoutMs,
      })
      .toBeTruthy();

    await expect
      .poll(async () => await locator.evaluate((element) => element.classList.contains("db-viewer-list-item--highlight")), {
        timeout: timeoutMs,
      })
      .toBeFalsy();
  }

  async function assertIsNotLinked(page: Page, controlId: string) {
    const locator = page.locator(controlId);
    await expect(locator).toBeVisible();
    await expect(locator.locator("..")).not.toHaveJSProperty("tagName", "A");
  }

  async function assertIsLinked(page: Page, controlId: string) {
    const locator = page.locator(controlId);
    await expect(locator).toBeVisible();
    await expect(locator.locator("..")).toHaveJSProperty("tagName", "A");
  }

  async function setEditorFieldValue({ page, config, testInfo, field, recordId, value }: PageConfigParams & SetEditorFieldValueParams) {
    const elementId = buildEditorFieldId({ page, config, testInfo, field, recordId });
    const locator = page.locator(elementId);
    const tagName = await locator.evaluate((element) => element.tagName.toLowerCase());

    if (tagName === "select") {
      await locator.selectOption(field.endsWith("--type") ? documentType(value) : value);
      return;
    }

    await locator.fill(value);
  }

  function documentType(value: string) {
    const types = ["Unknown", "HTML", "Markdown", "PDF", "Text", "Word", "Other"];
    return types.find((type) => type.toLowerCase() === value.toLowerCase()) ?? value;
  }

  async function expandSection({ page, config }: { page: Page; config: EntityConfig }) {
    const expander = page.locator(config.container());
    await expect(expander).toBeVisible({ timeout: 3000 });
    if (!(await expander.evaluate((element) => element.classList.contains("expanded")))) {
      await expander.locator("> .header > .title").click();
    }
    await expect(expander).toHaveClass(/\bexpanded\b/);
  }

  async function expandRecordDetails({ page, config, entityId }: { page: Page; config: EntityConfig; entityId: number }) {
    const form = page.locator(config.formId());
    if (await form.isVisible().catch(() => false)) {
      return;
    }

    const record = page.locator(config.recordId(entityId));
    const details = record.locator(".expander").first();
    await expect(details).toBeVisible({ timeout: 3000 });

    const isOpen = await details.evaluate((element) => element.classList.contains("expanded"));
    if (!isOpen) {
      await details.locator("> .header > .title").click();
    }

    await expect(details).toHaveClass(/\bexpanded\b/);
  }

  async function seedTheDatabase({ page, testInfo, seeds }: { page: Page; testInfo: TestInfo; seeds: Record<string, EntitySeed> }) {
    const seedEntries = Object.entries(seeds);

    for (const [_, seed] of seedEntries) {
      let payload = structuredClone(seed.data);
      const linkedPosting = {
        title: "Senior Engineer",
        company: "Contoso",
        location: "Remote",
        salary: "$150,000",
        workModel: "Remote",
        url: "https://example.com/job/7",
        document: {
          title: "Senior Engineer",
          type: "Markdown",
          content: "# Senior Engineer",
          source: "https://example.com/job/7",
        },
      };

      if (seed.route === "job-applications") {
        if (!payload.sourceId && !payload.source) {
          delete payload.sourceId;
          payload.source = { name: "LinkedIn" };
        }

        if (!payload.jobPostingId && !payload.jobPosting) {
          delete payload.jobPostingId;
          payload.jobPosting = linkedPosting;
        }
      }

      const response = await callServer({
        page,
        testInfo,
        route: seed.route,
        method: "POST",
        data: payload,
      });

      expect(response.status).toBe(201);
      expect(response.json.id).toBeGreaterThan(0);
      seed.created = response.json;
    }

    const entityId = seeds["primary"]?.created?.id;
    if (!entityId) {
      throw new Error("Expected a persisted primary fixture record.");
    }
    return entityId;
  }
}
