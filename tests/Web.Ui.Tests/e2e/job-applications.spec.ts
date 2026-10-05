import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { getPatch } from "../../../src/Web.Ui/src/utilities/entities";
import { callServer, cleanupDbViewerTestFlow, getTestHeaders, initiateDbViewerTestFlow, resetPersistedUiState } from "./helpers";

const savedApplicationsSelector = "#job-applications--saved-applications";

async function seedApplication(page: Page, testInfo: TestInfo, company = "Contoso", role = "Senior Engineer", appliedOnDate: string | null = null) {
  const response = await callServer({
    page,
    testInfo,
    route: "job-applications",
    method: "POST",
    data: {
      company,
      role,
      appliedOnDate,
      status: "Draft",
      source: { name: "LinkedIn" },
      jobPosting: {
        title: role,
        company,
        location: "Remote",
        salary: "$150,000",
        workModel: "Remote",
        url: "https://example.com/job/seeded-application",
        document: {
          title: role,
          type: "Markdown",
          content: `# ${role}`,
          source: "https://example.com/job/seeded-application",
        },
      },
    },
  });
  expect(response.status).toBe(201);
  return response.json as { id: number; sourceId: number; jobPostingId: number };
}

async function openApplications(page: Page) {
  const loaded = page.waitForResponse((response) =>
    new URL(response.url()).pathname === "/api/v1/job-applications" && response.request().method() === "GET",
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Job Applications", exact: true }).click();
  expect((await loaded).ok()).toBeTruthy();
  return page.locator(savedApplicationsSelector);
}

async function openApplicationRow(page: Page, id: number) {
  const section = await openApplications(page);
  await section.locator("> .header > .title").click();
  const row = section.locator(`#job-applications--saved-applications--record-${id}`);
  await expect(row).toBeVisible();
  return row;
}

async function openApplicationEditor(page: Page, id: number) {
  const row = await openApplicationRow(page, id);
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = row.locator(`#entity-editor-job-application--editor--${id}`);
  await expect(editor).toBeVisible();
  return { row, editor };
}

test.describe("Feature: Job Applications", () => {
  test.use({ locale: "en-US", timezoneId: "America/Los_Angeles" });

  test.beforeEach(async ({ page }, testInfo) => {
    await resetPersistedUiState(page);
    await initiateDbViewerTestFlow(page, testInfo);
    await cleanupDbViewerTestFlow(page, testInfo);
    const section = await openApplications(page);
    await expect(section.locator("> .header .count")).toHaveText("0 record(s)");
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

    await jobPostingsTab.click();
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

  test("Scenario: Saved Applications expander starts empty", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "Job Applications" }).click();

    const savedApplications = page.locator("#job-applications--saved-applications");
    const header = savedApplications.locator("> .header > .title");
    await expect(header).toContainText("Saved Applications");
    await expect(savedApplications).toHaveClass(/\bcollapsed\b/);
    await expect(savedApplications.locator("> .expanded")).toBeHidden();

    await header.click();

    await expect(savedApplications).toHaveClass(/\bexpanded\b/);
    await expect(savedApplications.locator(".empty-list:not(.loading)")).toHaveText("No saved job applications yet.");
  });

  test("Scenario: Saved Applications expander loads saved job applications from the real server", async ({ page }, testInfo) => {
    const application = await seedApplication(page, testInfo);
    const row = await openApplicationRow(page, application.id);
    await expect(row).toContainText("Contoso");
    await expect(row).toContainText("Senior Engineer");
    await expect(row).toContainText("Draft");
    await expect(page.locator(`${savedApplicationsSelector} ul.data-list > li`)).toHaveCount(1);
  });

  test("Scenario: Saved Applications displays a server-supplied applied date without timezone drift", async ({ page }, testInfo) => {
    const application = await seedApplication(page, testInfo, "Date Check Co", "Date Check Role", "2026-09-15");
    const row = await openApplicationRow(page, application.id);
    await row.locator(".expander > .header > .title").click();
    await expect(row.locator(".applied-on-date")).toHaveText("Sep 15, 2026");
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(row.getByLabel("Applied On", { exact: true })).toHaveValue("2026-09-15");
  });

  test("Scenario: The saved application editor appears inline with the matching record item", async ({ page }, testInfo) => {
    const application = await seedApplication(page, testInfo, "Inline Co", "Inline Role");
    const other = await seedApplication(page, testInfo, "Other Co", "Other Role");
    const { row, editor } = await openApplicationEditor(page, application.id);
    await expect(editor.getByLabel("Company", { exact: true })).toHaveValue("Inline Co");
    await expect(row.locator(`[id="entity-display-job-application-display--${application.id}"]`)).toHaveCount(0);
    const otherRow = page.locator(`#job-applications--saved-applications--record-${other.id}`);
    await expect(otherRow).toContainText("Other Co");
    await expect(otherRow.locator(".entity-editor")).toHaveCount(0);
  });

  test("Scenario: The saved application editor matches the shared DB Viewer form styling", async ({ page }, testInfo) => {
    const application = await seedApplication(page, testInfo, "Style Co", "Styling Role", "2026-09-15");
    const { editor } = await openApplicationEditor(page, application.id);
    await expect(editor).toHaveClass(/\bentity-editor\b/);
    await expect(editor.getByLabel("Id", { exact: true })).toHaveAttribute("readonly");
    for (const label of ["Company", "Role", "Applied On", "Status", "Source Id", "Job Posting Id", "Resume Id", "Cover Letter Id", "AI Prompt Id"]) {
      await expect(editor.getByLabel(label, { exact: true })).toBeVisible();
    }
    const status = editor.getByRole("combobox", { name: "Status", exact: true });
    await expect(status).toHaveValue("Draft");
    await expect(status.locator("option")).toHaveText([
      "Unknown", "Draft", "Saved", "Applied", "Interviewing", "Offer", "Accepted", "Rejected", "Withdrawn", "Ghosted", "Other",
    ]);
    await expect(editor.locator("> .header").getByRole("button", { name: "Save", exact: true })).toHaveClass(/\bbutton--primary\b/);
  });

  test("Scenario: The saved application editor shows child references in display mode beneath their IDs", async ({ page }, testInfo) => {
    const application = await seedApplication(page, testInfo, "Display Co", "Display Role");
    const { editor } = await openApplicationEditor(page, application.id);
    await expect(editor.getByLabel("Source Id", { exact: true })).toHaveValue(String(application.sourceId));
    const source = editor.locator(".entity-reference.source");
    await expect(source).toContainText("LinkedIn");
    await expect(source.getByRole("button")).toHaveCount(0);
    await expect(editor.getByLabel("Job Posting Id", { exact: true })).toHaveValue(String(application.jobPostingId));
    const posting = editor.locator(".entity-reference.job-posting");
    await expect(posting).toContainText("Display Role");
    await expect(posting.getByRole("button")).toHaveCount(0);
  });

  test("Scenario: Pressing Edit on a saved application opens the editor and updates the record", async ({ page }, testInfo) => {
    const application = await seedApplication(page, testInfo, "Editor Co", "Editor Role", "2026-09-15");
    const { row, editor } = await openApplicationEditor(page, application.id);
    await editor.getByLabel("Company", { exact: true }).fill("Updated Editor Co");
    const saved = page.waitForResponse((response) =>
      new URL(response.url()).pathname === `/api/v1/job-applications/${application.id}` && response.request().method() === "PATCH",
    );
    await editor.locator("> .header").getByRole("button", { name: "Save", exact: true }).click();
    const response = await saved;
    expect(response.request().postDataJSON()).toEqual({ company: "Updated Editor Co" });
    expect(response.ok(), await response.text()).toBeTruthy();
    await expect(editor).toHaveCount(0);
    await expect(row).toContainText("Updated Editor Co");
    const reloadedRow = await openApplicationRow(page, application.id);
    await expect(reloadedRow).toContainText("Updated Editor Co");
  });

  test("Scenario: Partial updates preserve IDs for changed linked records", () => {
    const original = {
      id: 7,
      source: { id: 3, name: "LinkedIn", createdAt: "2026-09-15", updatedAt: "2026-09-15" },
      notes: [{ date: "2026-09-15", content: "Follow up" }],
    };
    const updated = structuredClone(original);
    expect(getPatch(original, updated)).toEqual({});
    updated.source.name = "Referral";
    expect(getPatch(original, updated)).toEqual({ source: { id: 3, name: "Referral" } });
    updated.notes[0].content = "Follow up tomorrow";
    expect(getPatch(original, updated)).toEqual({
      source: { id: 3, name: "Referral" },
      notes: [{ date: "2026-09-15", content: "Follow up tomorrow" }],
    });
  });

  test.describe("Scenario Outline: Saved Applications use the per-test database flow", () => {
    for (const channel of ["X-JSA-Test-Flow", "jsa_test_flow"] as const) {
      test(`Flow: ${channel}`, async ({ page, browser }, testInfo) => {
        const application = await seedApplication(page, testInfo, "Isolated Co", "Isolated Role");
        const flowId = getTestHeaders(testInfo)["X-JSA-Test-Flow"];
        await configureFlow(page, flowId);
        const loaded = page.waitForResponse((response) =>
          new URL(response.url()).pathname === "/api/v1/job-applications" && response.request().method() === "GET",
        );
        const row = await openApplicationRow(page, application.id);
        const response = await loaded;
        if (channel === "X-JSA-Test-Flow") {
          expect(response.request().headers()["x-jsa-test-flow"]).toBe(flowId);
        } else {
          expect(response.request().headers()["x-jsa-test-flow"]).toBeUndefined();
          expect((await response.request().allHeaders()).cookie).toContain(`jsa_test_flow=${flowId}`);
        }
        await expect(row).toContainText("Isolated Co");

        const otherContext = await browser.newContext({ baseURL: "http://localhost:5173" });
        const otherFlowId = `other-${testInfo.testId}`;
        try {
          const otherPage = await otherContext.newPage();
          await configureFlow(otherPage, otherFlowId);
          const otherSection = await openApplications(otherPage);
          await expect(otherSection.locator("> .header .count")).toHaveText("0 record(s)");
          const cleaned = await otherPage.request.get("http://localhost:5000/api/v1/admin/clean-test-db", {
            headers: { "X-JSA-Test-Flow": otherFlowId, "X-JSA-Test-Cleanup": "true" },
          });
          expect(cleaned.ok()).toBeTruthy();
        } finally {
          await otherContext.close();
        }

        await expect(await openApplicationRow(page, application.id)).toContainText("Isolated Co");
        await cleanupDbViewerTestFlow(page, testInfo);
        const freshSection = await openApplications(page);
        await expect(freshSection.locator("> .header .count")).toHaveText("0 record(s)");

        async function configureFlow(targetPage: Page, targetFlowId: string) {
          await targetPage.setExtraHTTPHeaders(channel === "X-JSA-Test-Flow" ? { "X-JSA-Test-Flow": targetFlowId } : {});
          if (channel === "jsa_test_flow") {
            await targetPage.context().addCookies([{ name: "jsa_test_flow", value: targetFlowId, url: "http://localhost:5173" }]);
          }
        }
      });
    }
  });
});
