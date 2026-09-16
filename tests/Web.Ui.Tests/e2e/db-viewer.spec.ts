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
            jobApplicationId: 0,
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

    test("Scenario: Daily backups list is visible in the DB Viewer tab", async ({ page }) => {
      await page.route("**/api/v1/admin/db-backups", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(["JobSearchAssistant.db.2026-09-14T08-00-00Z", "JobSearchAssistant.db.2026-09-13T08-00-00Z"]),
          });
        }
      });

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      const backupSection = page.locator("#db-viewer--db-backups--container");
      await expect(backupSection).toBeVisible();
      await expect(page.locator("#db-viewer--db-backups--count")).toContainText("2 saved");
      await expect(page.locator("#db-viewer--db-backups--list")).toContainText("JobSearchAssistant.db.2026-09-14T08-00-00Z");
      await expect(page.locator("#db-viewer--db-backups--list")).toContainText("JobSearchAssistant.db.2026-09-13T08-00-00Z");
    });

    test("Scenario: Create Snapshot button creates a new daily snapshot", async ({ page }) => {
      let snapshotCallCount = 0;

      await page.route("**/api/v1/admin/db-snapshot", async (route) => {
        snapshotCallCount += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ path: "JobSearchAssistant.db.2026-09-14T10-20-30Z" }),
        });
      });

      await page.route("**/api/v1/admin/db-backups", async (route) => {
        if (route.request().method() === "GET") {
          const payload =
            snapshotCallCount > 0
              ? ["JobSearchAssistant.db.2026-09-14T10-20-30Z", "JobSearchAssistant.db.2026-09-13T08-00-00Z"]
              : ["JobSearchAssistant.db.2026-09-13T08-00-00Z"];

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(payload),
          });
        }
      });

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      await page.locator("#db-viewer--db-backups--create-snapshot-button").click();

      await expect(page.locator("#db-viewer--db-backups--list")).toContainText("JobSearchAssistant.db.2026-09-14T10-20-30Z");
      await expect(page.locator("#db-viewer--db-backups--count")).toContainText("2 saved");
      expect(snapshotCallCount).toBeGreaterThan(0);
    });

    test("Scenario: Export button opens record selection and downloads JSON", async ({ page }) => {
      await page.route("**/api/v1/job-postings**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
              {
                id: 1,
                title: "Senior Engineer",
                company: "Contoso",
                location: "Remote",
                salary: "$150,000",
                workModel: "Remote",
                url: "https://example.com/job/1",
                document: {
                  id: 10,
                  title: "Senior Engineer",
                  type: "markdown",
                  content: "# Senior Engineer",
                  source: "https://example.com/job/1",
                },
              },
              {
                id: 2,
                title: "Platform Engineer",
                company: "Fabrikam",
                location: "Austin, TX",
                salary: "$175,000",
                workModel: "Hybrid",
                url: "https://example.com/job/2",
                document: {
                  id: 11,
                  title: "Platform Engineer",
                  type: "markdown",
                  content: "# Platform Engineer",
                  source: "https://example.com/job/2",
                },
              },
            ]),
          });
        }
      });

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      await page.locator("#db-viewer--job-postings--export-button").click();

      await expect(page.locator("#db-viewer--job-postings--export-dialog")).toBeVisible();
      await expect(page.locator("#db-viewer--job-postings--export-record-1-checkbox")).toBeVisible();
      await expect(page.locator("#db-viewer--job-postings--export-record-2-checkbox")).toBeVisible();

      const downloadPromise = page.waitForEvent("download");
      await page.locator("#db-viewer--job-postings--export-confirm-button").click();
      const download = await downloadPromise;

      await expect(download.suggestedFilename()).toMatch(/\.json$/i);
    });

    test("Scenario: Canceling export closes the selection list", async ({ page }) => {
      await page.route("**/api/v1/job-postings**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
              {
                id: 1,
                title: "Senior Engineer",
                company: "Contoso",
                location: "Remote",
                salary: "$150,000",
                workModel: "Remote",
                url: "https://example.com/job/1",
                document: {
                  id: 10,
                  title: "Senior Engineer",
                  type: "markdown",
                  content: "# Senior Engineer",
                  source: "https://example.com/job/1",
                },
              },
            ]),
          });
        }
      });

      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      await page.locator("#db-viewer--job-postings--export-button").click();
      await expect(page.locator("#db-viewer--job-postings--export-dialog")).toBeVisible();

      await page.locator("#db-viewer--job-postings--export-cancel-button").click();

      await expect(page.locator("#db-viewer--job-postings--export-dialog")).toBeHidden();
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

      const importedRow = page.locator("[id^='db-viewer--job-postings--record-']").filter({ hasText: "Imported Engineer" }).first();

      await expect(importedRow).toBeVisible({ timeout: 10000 });

      const importedResponse = await page.request.get("http://localhost:5000/api/v1/job-postings?deep=true", {
        headers: getTestHeaders(testInfo),
      });
      const importedRecords = await importedResponse.json();
      const importedRecord = importedRecords.find((record: any) => record.title === "Imported Engineer");
      expect(importedRecord, "The real server should save the imported record with a new ID.").toBeTruthy();

      const importedId = Number(importedRecord.id);
      expect(importedId).not.toBe(existingId);

      const importedRowById = page.locator(`#db-viewer--job-postings--record-${importedId}`);
      await expect(importedRowById).toBeVisible({ timeout: 5000 });
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
      const importedRecordRow = page.locator(`#db-viewer--job-postings--record-${importedId}`);
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
      await page.locator("#db-viewer--ai-prompts--container--summary").click();

      const deleteButton = page.locator(`#db-viewer--ai-prompts--delete-button--record-${aiPromptId}`);
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
      await page.locator("#db-viewer--job-postings--container--summary").click();

      const deleteButton = page.locator(`#db-viewer--job-postings--delete-button--record-${recordId}`);
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
      await page.locator("#db-viewer--job-postings--container--summary").click();

      const deleteButton = page.locator(`#db-viewer--job-postings--delete-button--record-${recordId}`);
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
      await page.locator("#db-viewer--job-postings--container--summary").click();

      const deleteButton = page.locator(`#db-viewer--job-postings--delete-button--record-${jobPostingId}`);
      await expect(deleteButton).toBeVisible({ timeout: 10000 });
      await deleteButton.click();

      const deleteDialog = page.locator("#db-viewer--job-postings--delete-dialog");
      const failureDialog = page.locator("#db-viewer--job-postings--delete-failure-dialog");
      await expect(deleteDialog).toBeVisible({ timeout: 10000 });
      await page.locator("#db-viewer--job-postings--delete-confirm-button").click();

      await expect(failureDialog).toBeVisible({ timeout: 10000 });
      const promptReferenceLink = failureDialog.locator(`a[href='#db-viewer--ai-prompts--record-${promptId}']`);
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
      await page.locator("#db-viewer--job-postings--container--summary").click();

      const deleteButton = page.locator(`#db-viewer--job-postings--delete-button--record-${jobPostingId}`);
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
      const importedRecordRow = page.locator("#db-viewer--ai-prompts--list li").filter({ hasText: importedAiPromptName }).first();

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
      await page.locator("#db-viewer--job-postings--container--summary").click();

      shouldFailJobPostingRefresh = true;
      const refreshResponse = page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response.url().includes("/api/v1/job-postings") &&
          response.url().includes("deep=true") &&
          response.status() === 500,
      );

      await page.locator("#db-viewer--job-postings--refresh-button").click();
      await refreshResponse;

      await expect(page.locator("#db-viewer--job-postings--refresh-status")).toContainText(
        "Unable to refresh job postings. (500: Job posting refresh failed)",
      );
    });

    test.describe("Scenario Outline: Entities visible in the DB Viewer", () => {
      type LocalEntityConfig = EntityConfig & {
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

        await expect(page.locator(config.controlId("count"))).toContainText("saved");
        await expect(page.locator(config.controlId("refresh-button"))).toBeVisible();

        await expect(page.locator(config.controlId("list"))).toBeVisible();

        const rowSummary = page.locator(config.recordId(entityId)).locator("summary").first();
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
        const config = {
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
        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();

        const setupValues = config.setup ? await config.setup({ page, testInfo }) : {};

        await page.locator(config.createButtonId).click();
        await expect(page.locator(config.formId)).toBeVisible();

        for (const fieldConfig of config.fields) {
          const value = fieldConfig.value;
          const control = page.locator(`${config.formId} [id$="${fieldConfig.field}"]`);
          const tagName = await control.evaluate((element) => element.tagName.toLowerCase());

          if (tagName === "select") {
            await control.selectOption(value);
          } else {
            await control.fill(value);
          }
        }

        for (const [field, value] of Object.entries(setupValues)) {
          const control = page.locator(`${config.formId} [id$="${field}"]`);
          if (await control.count()) {
            const tagName = await control.evaluate((element) => element.tagName.toLowerCase());
            if (tagName === "select") {
              await control.selectOption(value);
            } else {
              await control.fill(value);
            }
          }
        }

        const createRequest = page.waitForRequest((request) => {
          return request.method() === "POST" && request.url().endsWith(`/api/v1/${config.route}`) && request.postData() !== null;
        });

        const createResponse = page.waitForResponse((response) => {
          return response.request().method() === "POST" && response.url().endsWith(`/api/v1/${config.route}`) && response.ok();
        });

        await page.locator(config.saveButtonId).click();

        await createRequest;
        await createResponse;

        await expect(page.locator(config.countId)).toContainText("saved");
        await expect(page.locator(config.listId)).toContainText(config.expectedText);
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

        const expander = row.locator("details.db-viewer-record-expander").first();
        await expect(expander).toBeVisible();
        await expect(expander).not.toHaveAttribute("open", "");

        const summary = expander.locator("summary").first();
        const summaryText = await summary.textContent();
        expect(summaryText).toContain(String(entityId));

        const detailContent = expander.locator(".db-viewer-record-expander-content");
        await expect(detailContent).not.toBeVisible();

        const expectedSummaryValue = (() => {
          if (config.name === "Job Posting") return config.seeds.primary.data.title;
          return config.seeds.primary.data.name;
        })();

        await expect(summary).toContainText(String(entityId));
        await expect(summary).toContainText(expectedSummaryValue);
        await expect(detailContent).not.toBeVisible();

        await summary.click();
        await expect(expander).toHaveAttribute("open", "");
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

          const summary = row.locator("summary").first();
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
          assert,
        };

        await runTest_entitiesLinkToReferencedEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const summary = row.locator("summary").first();
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
          assert,
        };

        await runTest_entitiesLinkToReferencedEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const summary = row.locator("summary").first();
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
          assert,
        };

        await runTest_entitiesLinkToReferencedEntities({ page, testInfo, config });

        async function assert({ page, config }: InternalTestActionParams) {
          const record = config.seeds.primary.created;

          if (!record?.id) {
            throw new Error("Initial record ID not available.");
          }

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const summary = row.locator("summary").first();
          await expect(summary).toContainText(String(record.id));
          await expect(summary).toContainText(record.name ?? "");

          const jobPostingId = Number(record.jobPostingId ?? record.jobPosting?.id ?? record.id);
          const resumeId = Number(record.resumeId ?? record.resume?.id ?? record.id);
          const aiPromptTemplateId = Number(record.aiPromptTemplateId ?? record.aiPromptTemplate?.id ?? record.id);

          await expect(row.locator("a.db-viewer-list-item-read-header-link")).toHaveCount(3);
          await assertIsLinked(page, config.recordControlId(jobPostingId, "editor--job-posting--display--title"));
          await assertIsLinked(page, config.recordControlId(resumeId, "editor--resume--display--name"));
          await assertIsLinked(page, config.recordControlId(aiPromptTemplateId, "editor--ai-prompt-template--display--name"));
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

        await config.assert({ page, config });
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

          const aiPromptLink = recordRow.locator(`a[href='#db-viewer--ai-prompts--record-${aiPrompt.id}']`);
          await expect(aiPromptLink).toContainText(`AI Prompt ${aiPrompt.id} · ${aiPrompt.name}`);

          const jobApplicationLink = recordRow.locator(`a[href='#db-viewer--job-applications--record-${jobApplicationId}']`);
          await expect(jobApplicationLink).toContainText(`Job Application ${jobApplicationId} · Application Co`);

          await verifyBackReferenceWorks(page, recordRow, aiPrompt as { id: number; name: string });

          await expect(jobApplicationLink).toBeVisible();
          await clickDbViewerReferenceLink(jobApplicationLink);
          await expect(page.locator(`#db-viewer--job-applications--record-${jobApplicationId}`)).toBeVisible();
          await expect(page.locator(`#db-viewer--job-applications--container`)).toHaveAttribute("open", "");
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

          // NOTE: Nothing to test since there is nothing that references AI Prompts, yet.

          // const row = page.locator(config.recordId(record.id));
          // await expect(row).toBeVisible();

          // const recordRow = page.locator(config.recordId(record.id));
          // await expect(recordRow).toContainText("Referenced By");

          // await verifyBackReferenceWorks(page, recordRow, aiPrompt as { id: number; name: string });
        }
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

        await config.assert({ page, config });

        // const jobPostingRow = page.locator("#db-viewer--job-postings--record-9");
        // const referenceLink = jobPostingRow.locator("a[href='#db-viewer--ai-prompts--record-101']");

        // await expect(jobPostingRow).toContainText("Referenced By");
        // await expect(referenceLink).toContainText("AI Prompt 101 · Prompt 101");
        // await referenceLink.click();
        // await expect(page.locator("#db-viewer--ai-prompts--container")).toHaveAttribute("open", "");
        // await expect(page.locator("#db-viewer--ai-prompts--record-101")).toBeVisible();
      }

      function getSeedTargetRecordId(config: { name: string }, created: Record<string, any> | undefined): number {
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
        const referenceId = `#db-viewer--ai-prompts--record-${aiPrompt.id}`;
        const referenceLink = jobPostingRow.locator(`a[href='${referenceId}']`);
        await expect(referenceLink).toContainText(`AI Prompt ${aiPrompt.id} · ${aiPrompt.name}`);

        await clickDbViewerReferenceLink(referenceLink);

        await expect(page.locator("#db-viewer--ai-prompts--container")).toHaveAttribute("open", "");
        await expect(page.locator(referenceId)).toBeVisible();

        const targetRow = page.locator(referenceId);
        const targetExpander = targetRow.locator("details.db-viewer-record-expander").first();
        await expect(targetExpander).toHaveAttribute("open", "");
      }

      async function clickDbViewerReferenceLink(locator: Locator) {
        await expect(locator).toBeVisible({ timeout: 10000 });
        await locator.scrollIntoViewIfNeeded();
        await locator.click({ force: true, timeout: 10000 });
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

        const workModelField = page.locator(`#db-viewer--job-postings--editor--work-model--record-${record.id}`);
        await expect(workModelField).toBeVisible();
        await expect(workModelField).toHaveJSProperty("tagName", "SELECT");

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

        const statusField = page.locator(`#db-viewer--job-applications--editor--status--record-${record.id}`);
        await expect(statusField).toBeVisible();
        await expect(statusField).toHaveJSProperty("tagName", "SELECT");

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
          await page
            .locator(buildEditorFieldId({ field: "document--content", recordId: record.id }))
            .locator("xpath=ancestor::details[1]/summary")
            .click();
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
          await page
            .locator(buildEditorFieldId({ field: "document--content", recordId: record.id }))
            .locator("xpath=ancestor::details[1]/summary")
            .click();
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
          await page
            .locator(buildEditorFieldId({ field: "document--content", recordId: record.id }))
            .locator("xpath=ancestor::details[1]/summary")
            .click();
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
          await config.actions.arrange({ page, config: config });
        }

        if (config.actions.act) {
          await config.actions.act({ page, config: config });
        }

        const saveRequest = page.waitForRequest((request) => {
          const url = config.updateRoute(entityId);
          return request.method() === "PUT" && request.url().endsWith(url) && request.postData() !== null;
        });

        const saveResponse = page.waitForResponse((response) => {
          const url = config.updateRoute(entityId);
          return response.request().method() === "PUT" && response.url().endsWith(url) && response.ok();
        });

        await page.locator(config.saveButtonId(entityId)).click();

        await saveRequest;
        await saveResponse;

        if (config.actions.assert) {
          await config.actions.assert({ page, config: config });
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

        if (!record) {
          throw new Error("Initial record not created.");
        }

        if (!record.id) {
          throw new Error("Initial record ID not available.");
        }

        const verify = buildEditorVerifier({ page, config, testInfo, original, record });
        await verify("document--type", original.document?.type);
        await verify("document--content", original.document?.content);

        await setEditorFieldValue({ page, config, testInfo, field: "document--type", recordId: record.id, value: "html" });
        await page
          .locator(buildEditorFieldId({ page, config, testInfo, field: "document--content", recordId: record.id }))
          .locator("xpath=ancestor::details[1]/summary")
          .click();

        const updatedDocumentContent = `<h1>${config.seeds.primary.name} updated</h1>`;
        await setEditorFieldValue({
          page,
          config,
          testInfo,
          field: "document--content",
          recordId: record.id,
          value: updatedDocumentContent,
        });

        await page.locator(config.cancelButtonId(record.id)).scrollIntoViewIfNeeded();

        const saveRequest = page.waitForRequest((request) => {
          const url = config.updateRoute(entityId);
          return request.method() === "PUT" && request.url().endsWith(url) && request.postData() !== null;
        });

        const saveResponse = page.waitForResponse((response) => {
          const url = config.updateRoute(entityId);
          return response.request().method() === "PUT" && response.url().endsWith(url) && response.ok();
        });

        await saveButton.click();
        await saveRequest;
        await saveResponse;

        const verifyDisplay = buildEditorDisplayVerifier({ page, config, testInfo, original, record });
        await verifyDisplay("document--display--type", "html");
        await verifyDisplay("document--display--content", updatedDocumentContent);

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
        const actualValue = await page.locator(config.recordId(entityId)).locator("summary").first().textContent();
        await expect(actualValue).toContain(String(summaryValue));
        await expect(actualValue).not.toContain(editValue + " :: Updated");
      }
    });
  });

  /*****************************************************
   * Helpers
   *****************************************************/

  export type EntityConfig = {
    name: string;
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
  export type EntityRecord = EntityRecordData & { id?: number };
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
    verifyEditorField: (params: VerifyEditorFieldParams) => Promise<void>;
    verifyEditorDisplayField: (params: VerifyEditorFieldParams) => Promise<void>;
    setEditorFieldValue: (params: SetEditorFieldValueParams) => Promise<void>;
    buildEditorDisplayVerifier: (params: BuildKnownVerifierParams) => SimpleEditorVerifierFunction;
    buildEditorVerifier: (params: BuildKnownVerifierParams) => SimpleEditorVerifierFunction;
  };
  export type InternalTestActionParams = PageConfigParams & InternalTestActionVerifierParams;
  type InternalTestAction = (params: InternalTestActionParams) => Promise<void>;

  function build_common_entity({ build_id }: { build_id: (segments: string[]) => string }) {
    const result = {
      buildId: build_id,
      container: () => build_id(["container"]),
      recordId: (id: number) => build_id([build_record_id(id)]),
      editButtonId: (id: number) => build_id(["edit-button", `record-${id}`]),
      formId: () => build_id(["editor"]),
      saveButtonId: (id: number) => build_id(["editor", "save-button", `record-${id}`]),
      cancelButtonId: (id: number) => build_id(["editor", "cancel-button", `record-${id}`]),
      controlId: (controlName: string) => build_id([controlName]),
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
        buildEditorVerifier,
        buildEditorDisplayVerifier,
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

  function buildEditorFieldId({ page, config, field, recordId }: PageConfigParams & BuildEditorFieldIdParams) {
    const id = config.buildId(["editor", field, build_record_id(recordId)]);
    return id;
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
    const locator = page.locator(config.formId()).locator(`input${elementId}, textarea${elementId}, select${elementId}`);
    await expect(locator).toHaveCount(1);
    await expect(locator).toHaveValue(expectedValue);
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
    const elementId = buildEditorFieldId({ page, config, testInfo, field, recordId });
    const directLocator = page.locator(elementId);

    if ((await directLocator.count()) > 0) {
      await verifyDisplayField({ page, config, testInfo, elementId, expectedValue });
      return;
    }

    const summaryFieldNames = new Set(["id", "title", "name"]);
    if (summaryFieldNames.has(field)) {
      const summaryText = await page.locator(config.recordId(recordId)).locator("summary").first().textContent();
      await expect(summaryText).toContain(expectedValue);
      return;
    }

    await verifyDisplayField({ page, config, testInfo, elementId, expectedValue });
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
      await locator.selectOption(value);
      return;
    }

    await locator.fill(value);
  }

  async function expandSection({ page, config }: { page: Page; config: EntityConfig }) {
    const expander = page.locator(config.container());
    await expect(expander).toBeVisible({ timeout: 3000 });
    if (!(await expander.getAttribute("open"))) {
      const expanderSummary = expander.locator("summary").first();
      await expanderSummary.click();
    }
  }

  async function expandRecordDetails({ page, config, entityId }: { page: Page; config: EntityConfig; entityId: number }) {
    const form = page.locator(config.formId());
    if (await form.isVisible().catch(() => false)) {
      await expect(form).toBeVisible();
      return;
    }

    const record = page.locator(config.recordId(entityId));
    const details = record.locator("details.db-viewer-record-expander").first();
    await expect(details).toBeVisible({ timeout: 3000 });

    const isOpen = await details.evaluate((element) => (element as HTMLDetailsElement).open);
    if (!isOpen) {
      await details.locator("summary").first().click();
    }

    await expect(details).toHaveJSProperty("open", true);
  }

  async function seedTheDatabase({ page, testInfo, seeds }: { page: Page; testInfo: TestInfo; seeds: Record<string, EntitySeed> }) {
    const seedEntries = Object.entries(seeds);

    for (const [_, seed] of seedEntries) {
      let payload = structuredClone(seed.data);

      if (seed.route === "job-applications") {
        if (!payload.sourceId) {
          const sourceResponse = await callServer({
            page,
            testInfo,
            route: "job-sources",
            method: "POST",
            data: { name: "LinkedIn" },
          });
          payload.sourceId = sourceResponse.json.id;
        }

        if (!payload.jobPostingId) {
          const jobPostingResponse = await callServer({
            page,
            testInfo,
            route: "job-postings",
            method: "POST",
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
          });
          payload.jobPostingId = jobPostingResponse.json.id;
        }
      }

      if (seed.route === "job-questions" && !payload.jobApplicationId) {
        const sourceResponse = await callServer({
          page,
          testInfo,
          route: "job-sources",
          method: "POST",
          data: { name: "Question Source" },
        });

        const jobPostingResponse = await callServer({
          page,
          testInfo,
          route: "job-postings",
          method: "POST",
          data: {
            title: "Question Parent Role",
            company: "Question Parent Company",
            location: "Remote",
            salary: "$120,000",
            workModel: "Remote",
            url: "https://example.com/question-parent-role",
            document: {
              title: "Question Parent Role",
              type: "markdown",
              content: "# Question Parent Role",
              source: "question-parent-role",
            },
          },
        });

        const applicationResponse = await callServer({
          page,
          testInfo,
          route: "job-applications",
          method: "POST",
          data: {
            company: "Question Parent Company",
            role: "Question Parent Role",
            appliedOnDate: null,
            status: 1,
            sourceId: sourceResponse.json.id,
            jobPostingId: jobPostingResponse.json.id,
          },
        });
        payload.jobApplicationId = applicationResponse.json.id;
      }

      const response = await callServer({
        page,
        testInfo,
        route: seed.route,
        method: "POST",
        data: payload,
      });

      seed.created = response.json;
    }

    const entityId = seeds["primary"]?.created?.id;
    return entityId;
  }
}
