import { expect, test } from "@playwright/test";
import { generateExpanderStateTests, generateInputStateTests } from "./helpers";

test.describe("Feature: Resume Analyzer", () => {
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

    await page.route("**/api/v1/ai-prompt-templates/", async (route) => {
      const requestBody = route.request().postDataJSON();
      expect(requestBody).toMatchObject({
        name: "New candidate summary",
        document: {
          title: "New candidate summary",
          type: "Markdown",
          content: "Summarize the candidate using clear, role-oriented language.",
        },
      });
      expect(requestBody).not.toHaveProperty("template");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 123,
          name: "New candidate summary",
          documentId: 456,
          document: {
            id: 456,
            title: "New candidate summary",
            type: "Markdown",
            content: "Summarize the candidate using clear, role-oriented language.",
            source: null,
          },
          createdAt: "2026-01-01T00:00:00Z",
        }),
      });
    });

    await page.locator("#resume-analyzer--prompt-template--editor--name").fill("New candidate summary");
    await page
      .locator("#resume-analyzer--prompt-template--editor--content--editor")
      .fill("Summarize the candidate using clear, role-oriented language.");
    await page.locator("#resume-analyzer--prompt-template--editor--save-button").click();

    await expect(page.locator(".resume-analyzer-status")).toHaveText("Prompt template saved.");
    await expect(page.locator("#resume-analyzer--saved-prompt-templates--container")).toContainText("New candidate summary");
  });

  test("Scenario: Loading a saved AI Prompt Template loads the document content", async ({ page }) => {
    let sawDeepTemplateLoad = false;

    await page.route("**/api/v1/ai-prompt-templates/**", async (route) => {
      if (route.request().method() === "GET") {
        sawDeepTemplateLoad = sawDeepTemplateLoad || route.request().url().includes("deep=true");
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 99,
            name: "Candidate Summary",
            documentId: 100,
            document: {
              id: 100,
              title: "Candidate Summary",
              type: "Markdown",
              content: "# Candidate Summary\n\nSummarize the candidate using clear, role-oriented language.",
              source: null,
            },
            createdAt: "2026-01-01T00:00:00Z",
          },
        ]),
      });
    });

    await page.goto("/");
    await page.getByRole("tab", { name: "Resume Analyzer" }).click();
    await page.locator("#resume-analyzer--prompt-template--container > summary").click();
    await page.locator("#resume-analyzer--saved-prompt-templates--container > summary").click();

    const savedTemplateList = page.locator("#resume-analyzer--saved-prompt-templates--container .resume-analyzer-saved-item");
    const savedTemplateRow = savedTemplateList.filter({ hasText: "Candidate Summary" }).first();
    await expect(savedTemplateRow).toContainText("Candidate Summary");
    await savedTemplateRow.locator(".resume-analyzer-saved-summary").click();
    await expect(savedTemplateRow).toContainText("Summarize the candidate using clear, role-oriented language.");

    await savedTemplateRow.locator("button", { hasText: "Load" }).click();
    await expect(page.locator("#resume-analyzer--prompt-template--editor--name")).toHaveValue("Candidate Summary");
    await expect(page.locator("#resume-analyzer--prompt-template--editor--content--editor")).toHaveValue(/Candidate Summary/);
    await expect(sawDeepTemplateLoad).toBeTruthy();
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
