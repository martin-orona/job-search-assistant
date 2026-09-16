import { expect, test } from "@playwright/test";
import { callServer, cleanupDbViewerTestFlow, initiateDbViewerTestFlow, resetPersistedUiState } from "./helpers";

test.describe("Feature: Job Applications", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    console.log("Setting up for test:", testInfo.title, testInfo.testId);
    await resetPersistedUiState(page);
    await initiateDbViewerTestFlow(page, testInfo);
    await cleanupDbViewerTestFlow(page, testInfo);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await cleanupDbViewerTestFlow(page, testInfo);
    await resetPersistedUiState(page);
  });

  test("Scenario: Navigate to the Job Applications screen", async ({ page }) => {
    // Given the user is using the JSA
    await page.goto("/");

    const jobApplicationsTab = page.getByRole("tab", { name: "Job Applications" });
    const jobPostingsTab = page.getByRole("tab", { name: "Job Postings" });

    await expect(jobPostingsTab).toHaveAttribute("aria-selected", "true");
    await expect(jobApplicationsTab).toHaveAttribute("aria-selected", "false");

    // When the user clicks on the Job Applications tab
    await jobApplicationsTab.click();

    // Then the page content will change to display the Job Applications screen
    await expect(jobApplicationsTab).toHaveAttribute("aria-selected", "true");
    await expect(jobPostingsTab).toHaveAttribute("aria-selected", "false");

    const heading = page.getByRole("heading", { name: "Job Applications", level: 1 });
    await expect(heading).toBeVisible();
  });

  test("Scenario: Saved Applications expander displays a list of saved job applications", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Job Applications" }).click();

    const savedApplications = page.locator("#job-applications--saved-applications--container");
    await expect(savedApplications.locator("summary")).toContainText("Saved Applications");

    const list = page.locator("#job-applications--saved-applications--list");
    await expect(list).toBeHidden();

    await savedApplications.locator("summary").click();

    await expect(list).toBeVisible();
    await expect(list).toContainText("No saved job applications yet.");
  });

  test("Scenario: Saved Applications expander loads saved job applications from the real server", async ({ page }, testInfo) => {
    const sourceResponse = await callServer({
      page,
      testInfo,
      route: "job-sources",
      method: "POST",
      data: { name: "LinkedIn" },
    });
    expect(sourceResponse.ok, "The job source seed must exist before the job application can reference it.").toBeTruthy();

    const postingResponse = await callServer({
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
        url: "https://example.com/job/seeded-application",
        document: {
          title: "Senior Engineer",
          type: "markdown",
          content: "# Senior Engineer",
          source: "https://example.com/job/seeded-application",
        },
      },
    });
    expect(postingResponse.ok, "The job posting seed must exist before the job application can reference it.").toBeTruthy();

    const createResponse = await callServer({
      page,
      testInfo,
      route: "job-applications",
      method: "POST",
      data: {
        company: "Contoso",
        role: "Senior Engineer",
        appliedOnDate: null,
        status: 1,
        sourceId: Number(sourceResponse.json.id),
        jobPostingId: Number(postingResponse.json.id),
      },
    });
    expect(createResponse.ok, "The saved job application must be created in the test flow database before it can be listed.").toBeTruthy();

    await page.goto("/");
    await page.getByRole("tab", { name: "Job Applications" }).click();

    const savedApplications = page.locator("#job-applications--saved-applications--container");
    await savedApplications.locator("summary").click();

    const list = page.locator("#job-applications--saved-applications--list");
    await expect(list).toContainText("Contoso");
    await expect(list).toContainText("Senior Engineer");
    await expect(list).toContainText("Draft");
  });
});
