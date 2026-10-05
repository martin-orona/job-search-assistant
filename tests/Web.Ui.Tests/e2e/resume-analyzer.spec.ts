import { expect, test } from "@playwright/test";
import {
  callServer,
  cleanupDbViewerTestFlow,
  generateExpanderStateTests,
  generateInputStateTests,
  initiateDbViewerTestFlow,
  resetPersistedUiState,
} from "./helpers";

test.describe("Feature: Resume Analyzer", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await resetPersistedUiState(page);
    await initiateDbViewerTestFlow(page, testInfo);
    await cleanupDbViewerTestFlow(page, testInfo);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await cleanupDbViewerTestFlow(page, testInfo);
    await resetPersistedUiState(page);
  });

  test.describe("Scenario Outline: Saved entities use standardized listings", () => {
    for (const entity of [
      {
        name: "Resume",
        route: "resumes",
        parent: "resume",
        section: "saved-resumes",
        loadedField: "#resume-analyzer--resume--editor--name",
        loadedValue: "Listing regression",
      },
      {
        name: "AI Prompt Template",
        route: "ai-prompt-templates",
        parent: "prompt-template",
        section: "saved-prompt-templates",
        loadedField: "#resume-analyzer--prompt-template--editor--name",
        loadedValue: "Listing regression",
      },
      {
        name: "AI Prompt",
        route: "ai-prompts",
        parent: "ai-prompt",
        section: "ai-prompt--saved-ai-prompts",
        loadedField: "#resume-analyzer--ai-prompt--editor--ai-prompt-editor",
        loadedValue: "# Saved prompt",
      },
    ]) {
      test(`Entity: ${entity.name}`, async ({ page }, testInfo) => {
        const document = { title: "Listing regression", type: "Markdown", content: "# Resume content", source: "resume-listing-test" };
        const resume = { name: "Listing regression", jobTitle: "Engineer", date: "2026-10-04", document };
        const template = { name: "Listing regression", document };
        const prompt = {
          name: "Listing regression",
          aiName: "Copilot",
          aiUrl: "https://example.com/ai",
          jobPosting: {
            title: "Engineer",
            company: "Contoso",
            location: "Remote",
            workModel: "Remote",
            salary: "$150,000",
            url: "https://example.com/job",
            document,
          },
          resume,
          aiPromptTemplate: template,
          promptDocument: { ...document, content: "# Saved prompt" },
          responseDocument: { ...document, content: "Match Percentage: 91%" },
        };
        const created = await callServer({
          page,
          testInfo,
          route: entity.route,
          method: "POST",
          data: entity.route === "resumes" ? resume : entity.route === "ai-prompt-templates" ? template : prompt,
        });
        expect(created.status).toBe(201);
        const id = created.json.id;
        await page.goto("/");
        await page.getByRole("tab", { name: "Resume Analyzer" }).click();
        await page.locator(`#resume-analyzer--${entity.parent}--container > summary`).click();
        const section = page.locator(`#resume-analyzer--${entity.section}--container`);
        await expect(section).toHaveClass(/\bactionable-expander\b/);
        await expect(section.locator("> .header .count")).toHaveText("1 record(s)");
        if (!(await section.evaluate((element) => element.classList.contains("expanded")))) {
          await section.locator("> .header").click();
        }
        await expect(section.locator("ul.data-list")).toBeVisible();
        const row = section.locator(`li[id$='--record-${id}']`);
        await expect(row).toContainText("Listing regression");
        await row.getByRole("button", { name: "Load", exact: true }).click();
        await expect(page.locator(entity.loadedField)).toHaveValue(entity.loadedValue);
        await row.getByRole("button", { name: "Edit", exact: true }).click();
        const editor = row.locator("[id^='entity-editor-']");
        await editor.getByLabel("Name", { exact: true }).fill("Discard this edit");
        await editor.getByRole("button", { name: "Cancel", exact: true }).first().click();
        await expect(editor).toHaveCount(0);
        await expect(row).not.toContainText("Discard this edit");
        await row.getByRole("button", { name: "Edit", exact: true }).click();
        await editor.getByLabel("Name", { exact: true }).fill("Updated listing");
        const saved = page.waitForResponse(
          (response) => response.request().method() === "PATCH" && new URL(response.url()).pathname === `/api/v1/${entity.route}/${id}`,
        );
        await editor.getByRole("button", { name: "Save", exact: true }).first().click();
        const response = await saved;
        expect(response.ok(), await response.text()).toBeTruthy();
        expect(response.request().postDataJSON()).toEqual(
          entity.route === "ai-prompts"
            ? { name: "Updated listing" }
            : { name: "Updated listing", document: { id: created.json.document.id, title: "Updated listing" } },
        );
        await expect(editor).toHaveCount(0);
        await expect(row).toContainText("Updated listing");
        await row.locator(".expander.entity-display").first().locator("> .header").click();
        await expect(row.locator(".expander.entity-display").first()).toHaveClass(/\bexpanded\b/);
        await page.reload();
        await page.getByRole("tab", { name: "Resume Analyzer" }).click();
        await expect(row).toContainText("Updated listing");
        await expect(row.locator(".expander.entity-display").first()).toHaveClass(/\bexpanded\b/);
        await expect(page.locator(entity.loadedField)).toHaveValue(entity.loadedValue);
        await row.getByRole("button", { name: "Delete", exact: true }).first().click();
        const dialog = page.locator(`#delete-dialog--${id}`);
        await expect(dialog).toBeVisible();
        await expect(row.locator(".expander.entity-display").first()).toHaveClass(/\bbeing-deleted\b/);
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(row.locator(".expander.entity-display").first()).not.toHaveClass(/\bbeing-deleted\b/);
        await page.route(
          `**/api/v1/${entity.route}/${id}`,
          (route) => route.fulfill({ status: 500, contentType: "text/plain", body: "Deletion blocked for test" }),
          { times: 1 },
        );
        await row.getByRole("button", { name: "Delete", exact: true }).first().click();
        const failedDeletion = page.waitForResponse(
          (response) => response.request().method() === "DELETE" && new URL(response.url()).pathname === `/api/v1/${entity.route}/${id}`,
        );
        await dialog.getByRole("button", { name: "Delete", exact: true }).click();
        expect((await failedDeletion).status()).toBe(500);
        await expect(dialog).toContainText("Deletion blocked for test");
        await expect(row).toHaveCount(1);
        await dialog.getByRole("button", { name: "Dismiss", exact: true }).click();
        await row.getByRole("button", { name: "Delete", exact: true }).first().click();
        const deleted = page.waitForResponse(
          (response) => response.request().method() === "DELETE" && new URL(response.url()).pathname === `/api/v1/${entity.route}/${id}`,
        );
        await dialog.getByRole("button", { name: "Delete", exact: true }).click();
        const deletion = await deleted;
        expect(deletion.ok(), await deletion.text()).toBeTruthy();
        await expect(row).toHaveCount(0);
        await expect(section.locator("> .header .count")).toHaveText("0 record(s)");
        await section.locator("> .header").getByRole("button", { name: "Create", exact: true }).click();
        const newRow = section.locator("li[id$='--record-0']");
        await newRow.getByLabel("Name", { exact: true }).fill("Created inline");
        if (entity.route === "resumes") {
          await newRow.getByLabel("Job Title", { exact: true }).fill("Engineer");
          await newRow.getByLabel("Date", { exact: true }).fill("2026-10-04");
        }
        if (entity.route === "ai-prompts") {
          await newRow.getByLabel("AI Name", { exact: true }).fill("Copilot");
          await newRow.getByLabel("AI URL", { exact: true }).fill("https://example.com/ai");
          await newRow.getByLabel("Job Posting Id", { exact: true }).fill(String(created.json.jobPostingId));
          await newRow.getByLabel("Resume Id", { exact: true }).fill(String(created.json.resumeId));
          await newRow.getByLabel("AI Prompt Template Id", { exact: true }).fill(String(created.json.aiPromptTemplateId));
          await newRow.getByLabel("Content", { exact: true }).nth(1).fill("Match Percentage: 92%");
        }
        await newRow.getByLabel("Content", { exact: true }).first().fill("# Created inline content");
        const inlineCreated = page.waitForResponse(
          (response) => response.request().method() === "POST" && new URL(response.url()).pathname === `/api/v1/${entity.route}/`,
        );
        await newRow.getByRole("button", { name: "Save", exact: true }).first().click();
        const creation = await inlineCreated;
        expect(creation.status(), await creation.text()).toBe(201);
        const record = await creation.json();
        await expect(newRow).toHaveCount(0);
        await expect(section.locator(`li[id$='--record-${record.id}']`)).toContainText("Created inline");
        await expect(section.locator("> .header .count")).toHaveText("1 record(s)");
      });
    }
  });

  test.describe("Scenario: Expander restores its toggled state", () => {
    (() =>
      generateExpanderStateTests(
        [
          "#resume-analyzer--ai-prompt--container",
          "#resume-analyzer--ai-prompt--editor--prompt--container",
          "#resume-analyzer--ai-prompt--editor--ai-response--container",
          "#resume-analyzer--ai-prompt--saved-ai-prompts--container",
          "#resume-analyzer--job-description--container",
          "#resume-analyzer--job-description--content--container",
          "#resume-analyzer--resume--container",
          "#resume-analyzer--resume--editor--content--container",
          "#resume-analyzer--saved-resumes--container",
          "#resume-analyzer--prompt-template--container",
          "#resume-analyzer--prompt-template--editor--content--container",
          "#resume-analyzer--saved-prompt-templates--container",
        ],
        "Resume Analyzer",
      ))();
  });

  test.describe("Scenario: Input restores its value", () => {
    (() =>
      generateInputStateTests(
        [
          "#resume-analyzer--ai-prompt--ai-url",
          "#resume-analyzer--ai-prompt--editor--ai-url",
          "#resume-analyzer--resume--editor--name",
          "#resume-analyzer--resume--editor--job-title",
          "#resume-analyzer--resume--editor--date",
          "#resume-analyzer--resume--editor--id",
          "#resume-analyzer--resume--editor--document-type",
          "#resume-analyzer--resume--editor--content--editor",
          "#resume-analyzer--prompt-template--editor--name",
        ],
        "Resume Analyzer",
      ))();
  });

  test("Scenario: Navigate to the Resume Analyzer screen", async ({ page }) => {
    // Given the user is using the JSA
    await page.goto("/");
    const resumeAnalyzerTab = page.getByRole("tab", { name: "Resume Analyzer" });
    const jobPostingsTab = page.getByRole("tab", { name: "Job Postings" });

    await expect(jobPostingsTab).toHaveAttribute("aria-selected", "true");
    await expect(resumeAnalyzerTab).toHaveAttribute("aria-selected", "false");

    // When the user clicks on the Resume Analyzer tab
    await resumeAnalyzerTab.click();

    // Then the page content will change to display the Resume Analyzer screen
    await expect(resumeAnalyzerTab).toHaveAttribute("aria-selected", "true");
    await expect(jobPostingsTab).toHaveAttribute("aria-selected", "false");

    const heading = page.getByRole("heading", { name: "Resume Analyzer", level: 1 });
    await expect(heading).toBeVisible();

    const aiPromptSummary = page.locator(".ai-prompt-container > summary");
    await expect(aiPromptSummary).toBeVisible();
    await expect(aiPromptSummary).toHaveText("AI Prompt");
  });

  test("Scenario: Save a new AI Prompt Template succeeds and shows saved state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Resume Analyzer" }).click();
    await page.locator("#resume-analyzer--prompt-template--container > summary").click();
    await page.locator("#resume-analyzer--prompt-template--editor--content--container > summary").click();

    await page.locator("#resume-analyzer--prompt-template--editor--name").fill("New candidate summary");
    await page
      .locator("#resume-analyzer--prompt-template--editor--content--editor")
      .fill("Summarize the candidate using clear, role-oriented language.");
    const saved = page.waitForResponse(
      (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/ai-prompt-templates/",
    );
    await page.locator("#resume-analyzer--prompt-template--editor--save-button").click();
    const response = await saved;
    expect(response.status(), await response.text()).toBe(201);
    expect(response.request().postDataJSON()).toEqual({
      name: "New candidate summary",
      document: {
        title: "New candidate summary",
        type: "Markdown",
        content: "Summarize the candidate using clear, role-oriented language.",
      },
    });
    const created = await response.json();
    const section = page.locator("#resume-analyzer--saved-prompt-templates--container");
    await expect(section.locator("> .header .count")).toHaveText("1 record(s)");
    await section.locator("> .header").click();
    await expect(section.locator(`li[id$='--record-${created.id}']`)).toContainText("New candidate summary");
  });

  test("Scenario: Loading a saved AI Prompt Template loads the document content", async ({ page }, testInfo) => {
    const content = "# Candidate Summary\n\nSummarize the candidate using clear, role-oriented language.";
    const created = await callServer({
      page,
      testInfo,
      route: "ai-prompt-templates",
      method: "POST",
      data: {
        name: "Candidate Summary",
        document: { title: "Candidate Summary", type: "Markdown", content },
      },
    });
    expect(created.status).toBe(201);
    await page.goto("/");
    const loaded = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname === "/api/v1/ai-prompt-templates/" &&
        new URL(response.url()).searchParams.get("deep") === "true",
    );
    await page.getByRole("tab", { name: "Resume Analyzer" }).click();
    expect((await loaded).ok()).toBeTruthy();
    await page.locator("#resume-analyzer--prompt-template--container > summary").click();
    const section = page.locator("#resume-analyzer--saved-prompt-templates--container");
    await section.locator("> .header").click();
    const savedTemplateRow = section.locator(`li[id$='--record-${created.json.id}']`);
    await expect(savedTemplateRow).toContainText("Candidate Summary");
    await savedTemplateRow.getByRole("button", { name: "Load", exact: true }).click();
    await expect(page.locator("#resume-analyzer--prompt-template--editor--name")).toHaveValue("Candidate Summary");
    await expect(page.locator("#resume-analyzer--prompt-template--editor--content--editor")).toHaveValue(content);
  });

  test("Scenario: Save failure is displayed to the user", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Resume Analyzer" }).click();
    await page.locator("#resume-analyzer--prompt-template--container > summary").click();
    await page.locator("#resume-analyzer--prompt-template--editor--content--container > summary").click();

    await page.route("**/api/v1/ai-prompt-templates/", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "text/plain",
        body: "Template validation failed",
      });
    });

    await page.locator("#resume-analyzer--prompt-template--editor--name").fill("Broken template");
    await page.locator("#resume-analyzer--prompt-template--editor--content--editor").fill("This should fail to save.");
    await page.locator("#resume-analyzer--prompt-template--editor--save-button").click();

    await expect(page.locator(".resume-analyzer-status")).toHaveText(
      "Unable to save the prompt template. (500: Template validation failed)",
    );
  });

  test("Scenario: Save failure for the AI prompt includes the server reason", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "jobSearchAssistant.selectedJobPosting",
        JSON.stringify({
          id: 42,
          title: "Senior Developer",
          company: "Contoso",
          location: "Remote",
          salary: "$120k",
          workModel: "Remote",
          url: "https://example.com/jobs/42",
          documentId: 7,
          createdAt: "2026-01-01T00:00:00Z",
          document: {
            id: 7,
            title: "Senior Developer",
            type: "Markdown",
            content: "We are looking for a senior developer.",
            source: null,
          },
        }),
      );
      localStorage.setItem(
        "jobSearchAssistant.resumeAnalyzer.loadedResume",
        JSON.stringify({
          id: "9",
          name: "Jane Doe",
          jobTitle: "Engineer",
          date: "2026-09-13",
          documentId: "11",
          documentType: "Markdown",
          content: "Experience summary",
        }),
      );
      localStorage.setItem(
        "jobSearchAssistant.resumeAnalyzer.loadedTemplate",
        JSON.stringify({
          id: "5",
          name: "Candidate summary",
          template: "Summarize [YOUR RESUME HERE] for [JOB DESCRIPTION HERE].",
        }),
      );
    });

    await page.goto("/");
    await page.getByRole("tab", { name: "Resume Analyzer" }).click();

    await page.route("**/api/v1/ai-prompts/", async (route) => {
      const requestBody = route.request().postDataJSON();
      expect(requestBody).toMatchObject({
        name: "Jane Doe vs Senior Developer",
        aiUrl: "https://example.com",
        jobPostingId: 42,
        resumeId: 9,
        aiPromptTemplateId: 5,
        promptDocument: {
          title: "Jane Doe vs Senior Developer prompt",
          type: "Markdown",
          content: "Generate a response for this candidate.",
        },
        responseDocument: {
          title: "Jane Doe vs Senior Developer response",
          type: "Markdown",
          content: "",
        },
      });

      await route.fulfill({
        status: 400,
        contentType: "text/plain",
        body: "AI prompt validation failed",
      });
    });

    await page.locator("#resume-analyzer--ai-prompt--container > summary").click();
    await page.locator("#resume-analyzer--ai-prompt--editor--prompt--container > summary").click();
    await page.locator("#resume-analyzer--ai-prompt--editor--ai-url").fill("https://example.com");
    await page.locator("#resume-analyzer--ai-prompt--editor--ai-prompt-editor").fill("Generate a response for this candidate.");
    await page.locator("#resume-analyzer--ai-prompt--save-ai-prompt-button").click();

    await expect(page.locator(".resume-analyzer-status")).toHaveText("Unable to save the AI prompt. (400: AI prompt validation failed)");
  });
});
