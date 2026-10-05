import { expect, test, type Page } from "@playwright/test";
import {
  callServer,
  cleanupDbViewerTestFlow,
  generateExpanderStateTests,
  generateInputStateTests,
  initiateDbViewerTestFlow,
  resetPersistedUiState,
} from "./helpers";

declare global {
  interface Window {
    jobPostingBridge: (type: string, url: string) => Promise<unknown>;
  }
}

const jobPostingUrl = "https://www.indeed.com/viewjob?jk=455de5af61ae4e7a";
const jobPostingHtml = `<!doctype html>
<html><head><title>Senior Software Engineer - Acme Corp</title></head><body>
  <div class="jobsearch-JobComponent">
    <div class="jobsearch-InfoHeaderContainer">
      <h1>Senior Software Engineer</h1>
      <div data-testid="inlineHeader-companyName"><a>Acme Corp</a></div>
      <div data-testid="job-location">Remote</div>
      <div data-testid="salaryInfoAndJobType"><span>$150,000 - $180,000 a year</span></div>
    </div>
    <div class="jobsearch-JobComponent-description">
      <p>We are seeking a Senior Software Engineer to build modern web applications.</p>
      <ul><li>Experience with TypeScript and React</li><li>Experience with C# and .NET</li></ul>
    </div>
  </div>
</body></html>`;

async function installJobPostingBridge(page: Page) {
  await page.context().route(jobPostingUrl, (route) => route.fulfill({ contentType: "text/html", body: jobPostingHtml }));
  await page.exposeBinding("jobPostingBridge", async (_source, type: string, url: string) => {
    if (type === "OPEN_URL_VISIBLE") {
      const postingPage = await page.context().newPage();
      await postingPage.goto(url);
      await postingPage.bringToFront();
      return { ok: true, snapshot: { url: postingPage.url() } };
    }
    const postingPage = page
      .context()
      .pages()
      .find((candidate) => candidate.url() === url);
    if (!postingPage) {
      return { ok: false, error: "No job posting tab is open for this URL." };
    }
    return {
      ok: true,
      snapshot: {
        title: await postingPage.title(),
        url,
        html: await postingPage.content(),
        text: await postingPage.locator("body").innerText(),
      },
    };
  });
  await page.addInitScript(() => {
    window.addEventListener("message", async (event) => {
      const message = event.data;
      if (message?.source !== "job-search-assistant-web-ui" || !["OPEN_URL_VISIBLE", "CAPTURE_TAB_BY_URL"].includes(message.type)) {
        return;
      }
      const response = await window.jobPostingBridge(message.type, message.url);
      window.postMessage({ source: "job-search-assistant-extension", requestId: message.requestId, response }, "*");
    });
  });
}

async function openJobPosting(page: Page) {
  await page.getByLabel("Posting URL").fill(jobPostingUrl);
  const opened = page.context().waitForEvent("page");
  await page.getByRole("button", { name: "Go", exact: true }).click();
  const postingPage = await opened;
  await expect(postingPage).toHaveURL(jobPostingUrl);
  await expect(postingPage.getByRole("heading", { name: "Senior Software Engineer" })).toBeVisible();
  return postingPage;
}

async function captureJobPosting(page: Page) {
  await openJobPosting(page);
  await page.bringToFront();
  await page.getByRole("button", { name: "Capture", exact: true }).click();
  await expect(page.frameLocator("#job-postings--job-post-page--content").locator("h1")).toHaveText("Senior Software Engineer");
}

test.describe("Feature: Job Postings", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await resetPersistedUiState(page);
    await initiateDbViewerTestFlow(page, testInfo);
    await cleanupDbViewerTestFlow(page, testInfo);
    await installJobPostingBridge(page);
    const initialList = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/v1/job-postings" && response.request().method() === "GET",
    );
    await page.goto("/");
    const response = await initialList;
    expect(response.ok()).toBeTruthy();
    expect(await response.json(), "Each flow must start with an empty real-server database.").toEqual([]);
  });

  test.afterEach(async ({ page }, testInfo) => {
    await resetPersistedUiState(page);
    await cleanupDbViewerTestFlow(page, testInfo);
  });

  test.describe("Scenario: Expander restores its toggled state", () => {
    (() =>
      generateExpanderStateTests(
        [
          "#job-postings--capture--container",
          "#job-postings--job-post-page--container",
          "#job-postings--formatted-content--container",
          "#job-postings--markdown-content--container",
          "#job-postings--saved-job-postings--container",
        ],
        "Job Postings",
      ))();
  });

  test.describe("Scenario: Input restores its value", () => {
    (() =>
      generateInputStateTests(
        [
          "#job-postings--capture--url",
          "#job-postings--formatted-content--remove-images-toggle",
          "#job-postings--formatted-content--remove-buttons-toggle",
        ],
        "Job Postings",
      ))();
  });

  test("Scenario: Navigate to a job posting", async ({ page }) => {
    const postingPage = await openJobPosting(page);
    await expect.poll(() => postingPage.evaluate(() => document.hasFocus())).toBe(true);
  });

  test("Scenario: Navigate to the Job Postings screen", async ({ page }) => {
    await page.getByRole("tab", { name: "Job Applications", exact: true }).click();
    const tab = page.getByRole("tab", { name: "Job Postings", exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel", { name: "Job Postings", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Job Postings", exact: true })).toBeVisible();
  });

  test("Scenario: Capture a job posting", async ({ page }) => {
    await captureJobPosting(page);
    const jobPostFrame = page.frameLocator("#job-postings--job-post-page--content");
    await expect(jobPostFrame.locator("h1")).toContainText("Senior Software Engineer");

    const formattedSummary = page.locator(".job-postings-expander summary", { hasText: "Formatted Content" });
    await formattedSummary.click();
    const formattedContent = page.locator(".job-postings-formatted");
    await expect(formattedContent).toBeVisible();
    await expect(formattedContent).toContainText("Senior Software Engineer");
    await expect(formattedContent).toContainText("Acme Corp");
    await expect(formattedContent.locator("li")).toHaveText(["Experience with TypeScript and React", "Experience with C# and .NET"]);

    const markdownSummary = page.locator(".job-postings-expander summary", { hasText: "Markdown Content" });
    await markdownSummary.click();
    const markdownTextarea = page.locator("textarea.job-postings-markdown");
    await expect(markdownTextarea).toBeVisible();
    await expect(markdownTextarea).toHaveValue(/Senior Software Engineer/);
    await expect(markdownTextarea).toHaveValue(/Acme Corp/);
    await expect(markdownTextarea).toHaveValue(/- Experience with TypeScript and React/);
  });

  test("Scenario: Saving a captured job posting succeeds with the real server flow", async ({ page }) => {
    await captureJobPosting(page);
    const savedResponse = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/v1/job-postings" && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const response = await savedResponse;
    expect(response.status()).toBe(201);
    const saved = await response.json();

    const savedSection = page.locator("#job-postings--saved-job-postings--container");
    await savedSection.locator("> .header > .title").click();
    const savedPosting = savedSection.locator(`#job-postings--saved-job-postings--container--record-${saved.id}`);
    await expect(savedPosting).toContainText("Senior Software Engineer");
    await expect(savedPosting).toContainText("Acme Corp");
    await page.reload();
    await expect(savedPosting).toContainText("Senior Software Engineer");
  });

  test("Scenario: Refresh loads saved job postings from the database", async ({ page }, testInfo) => {
    const seeded = await callServer({
      page,
      testInfo,
      route: "job-postings",
      method: "POST",
      data: {
        title: "Senior Software Engineer",
        company: "Acme Corp",
        location: "Remote",
        salary: "$150,000 - $180,000 a year",
        workModel: "Remote",
        url: "https://example.com/jobs/senior-software-engineer",
        document: {
          title: "Senior Software Engineer",
          type: "Markdown",
          content: "# Senior Software Engineer\n\nAcme Corp",
          source: "example.com",
        },
      },
    });

    const savedJobPostingsContainer = page.locator("#job-postings--saved-job-postings--container");
    await savedJobPostingsContainer.locator("> .header > .title").click();
    await expect(savedJobPostingsContainer.locator("ul.data-list > li")).toHaveCount(0);
    const refreshed = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/v1/job-postings" && response.request().method() === "GET",
    );
    await savedJobPostingsContainer.getByRole("button", { name: "Refresh records", exact: true }).click();
    expect((await refreshed).ok()).toBeTruthy();

    await expect(savedJobPostingsContainer.locator("ul.data-list > li")).toHaveCount(1);
    const savedPosting = savedJobPostingsContainer.locator(`#job-postings--saved-job-postings--container--record-${seeded.json.id}`);
    await expect(savedPosting).toContainText("Senior Software Engineer");
    await expect(savedPosting).toContainText("Acme Corp");
    await savedPosting.locator(".expander > .header > .title").click();
    await expect(savedPosting).toContainText("Remote");
    await expect(savedPosting).toContainText("$150,000 - $180,000 a year");
  });
});
