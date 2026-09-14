import { expect, test } from "@playwright/test";
import { cleanupDbViewerTestFlow, generateExpanderStateTests, generateInputStateTests, initiateDbViewerTestFlow } from "./helpers";

test.describe("Feature: Job Postings", () => {
  test.beforeEach(async ({ page, context, browser, request }, testInfo) => {
    console.log("Setting up for test:", testInfo.title, testInfo.testId);
    await initiateDbViewerTestFlow(page, testInfo);
    await cleanupDbViewerTestFlow(page, testInfo);
  });

  test.afterEach(async ({ page }, testInfo) => {
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

  test("Scenario: Navigate to a job posting", async ({ page, context }) => {
    const jobPostingUrl = "https://www.indeed.com/viewjob?jk=455de5af61ae4e7a";

    await page.route("**/api/v1/job-postings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    // Mock the browser extension bridge to handle OPEN_URL_VISIBLE by opening a tab
    await page.addInitScript(() => {
      window.addEventListener("message", (event) => {
        const data = event.data;
        if (data?.source === "job-search-assistant-web-ui" && data.type === "OPEN_URL_VISIBLE") {
          window.open(data.url, "_blank");
          window.postMessage(
            {
              source: "job-search-assistant-extension",
              requestId: data.requestId,
              response: {
                ok: true,
                snapshot: { url: data.url },
              },
            },
            "*",
          );
        }
      });
    });

    // Given the user is on the Job Postings screen
    await page.goto("/");
    const jobPostingsTab = page.getByRole("tab", { name: "Job Postings" });
    await expect(jobPostingsTab).toHaveAttribute("aria-selected", "true");

    // When the user types/pastes the URL into the URL textbox
    const urlInput = page.getByLabel("Posting URL");
    await urlInput.fill(jobPostingUrl);

    // And clicks on the Go button
    const [newPage] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Go", exact: true }).click()]);

    // Then the browser will open a new tab to the job posting URL
    expect(newPage.url()).toBe(jobPostingUrl);

    // And the focus will be placed on the new tab so that the user can see the job posting
    await newPage.bringToFront();
    expect(newPage).toBeTruthy();

    // And the JSA UI displays the opened status
    await expect(page.locator(".job-postings-status")).toContainText(`Opened ${jobPostingUrl}`);
  });

  test("Scenario: Capture a job posting", async ({ page, context }) => {
    const jobPostingUrl = "https://www.indeed.com/viewjob?jk=455de5af61ae4e7a";

    await page.route("**/api/v1/job-postings", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    const sampleHtml = `
      <div class="jobsearch-JobComponent">
        <div class="jobsearch-InfoHeaderContainer">
          <h1>Senior Software Engineer</h1>
          <div data-testid="inlineHeader-companyName"><a>Acme Corp</a></div>
          <div data-testid="job-location">Remote</div>
          <div data-testid="salaryInfoAndJobType"><span>$150,000 - $180,000 a year</span></div>
        </div>
        <div class="jobsearch-JobComponent-description">
          <p>We are seeking a Senior Software Engineer to build modern web applications.</p>
          <ul>
            <li>Experience with TypeScript and React</li>
            <li>Experience with C# and .NET</li>
          </ul>
        </div>
      </div>
    `;
    const sampleText =
      "Senior Software Engineer\nAcme Corp\nRemote\n$150,000 - $180,000 a year\nWe are seeking a Senior Software Engineer to build modern web applications.";

    // Mock the extension bridge for OPEN_URL_VISIBLE and CAPTURE_TAB_BY_URL
    await page.addInitScript(
      ({ expectedUrl, html, text }) => {
        window.addEventListener("message", (event) => {
          const data = event.data;
          if (data?.source !== "job-search-assistant-web-ui") {
            return;
          }

          if (data.type === "OPEN_URL_VISIBLE") {
            window.open(data.url, "_blank");
            window.postMessage(
              {
                source: "job-search-assistant-extension",
                requestId: data.requestId,
                response: {
                  ok: true,
                  snapshot: { url: data.url },
                },
              },
              "*",
            );
          } else if (data.type === "CAPTURE_TAB_BY_URL") {
            window.postMessage(
              {
                source: "job-search-assistant-extension",
                requestId: data.requestId,
                response: {
                  ok: true,
                  snapshot: {
                    title: "Senior Software Engineer - Acme Corp",
                    url: expectedUrl,
                    html,
                    text,
                  },
                },
              },
              "*",
            );
          }
        });
      },
      { expectedUrl: jobPostingUrl, html: sampleHtml, text: sampleText },
    );

    // Given the user is on the Job Postings screen
    await page.goto("/");
    const jobPostingsTab = page.getByRole("tab", { name: "Job Postings" });
    await expect(jobPostingsTab).toHaveAttribute("aria-selected", "true");

    // And there is an open tab to the URL in the URL textbox
    const urlInput = page.getByLabel("Posting URL");
    await urlInput.fill(jobPostingUrl);

    const [newPage] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Go", exact: true }).click()]);
    expect(newPage.url()).toBe(jobPostingUrl);
    await expect(page.locator(".job-postings-status")).toContainText(`Opened ${jobPostingUrl}`);

    // When the user clicks on the Capture button
    await page.getByRole("button", { name: "Capture", exact: true }).click();

    // Then the job posting will be copied from the job posting page/tab
    await expect(page.locator(".job-postings-status")).toContainText("Captured Senior Software Engineer.");

    // And the job posting page will be visible in the Job Post Page display
    const jobPostFrame = page.frameLocator("#job-postings--job-post-page--content");
    await expect(jobPostFrame.locator("h1")).toContainText("Senior Software Engineer");

    // And the extracted job posting content will be viewable in the Formatted Content display
    const formattedSummary = page.locator(".job-postings-expander summary", { hasText: "Formatted Content" });
    await formattedSummary.click();
    const formattedContent = page.locator(".job-postings-formatted");
    await expect(formattedContent).toBeVisible();
    await expect(formattedContent).toContainText("Senior Software Engineer");
    await expect(formattedContent).toContainText("Acme Corp");

    // And the extracted job posting content will be viewable in the Markdown Content display
    const markdownSummary = page.locator(".job-postings-expander summary", { hasText: "Markdown Content" });
    await markdownSummary.click();
    const markdownTextarea = page.locator("textarea.job-postings-markdown");
    await expect(markdownTextarea).toBeVisible();
    await expect(markdownTextarea).toHaveValue(/Senior Software Engineer/);
    await expect(markdownTextarea).toHaveValue(/Acme Corp/);
  });

  test("Scenario: Saving a captured job posting succeeds with the real server flow", async ({ page, context }) => {
    const jobPostingUrl = "https://www.indeed.com/viewjob?jk=455de5af61ae4e7a";

    await page.addInitScript(
      ({ expectedUrl, html, text }) => {
        window.addEventListener("message", (event) => {
          const data = event.data;
          if (data?.source !== "job-search-assistant-web-ui") {
            return;
          }

          if (data.type === "OPEN_URL_VISIBLE") {
            window.open(data.url, "_blank");
            window.postMessage(
              {
                source: "job-search-assistant-extension",
                requestId: data.requestId,
                response: {
                  ok: true,
                  snapshot: { url: data.url },
                },
              },
              "*",
            );
          } else if (data.type === "CAPTURE_TAB_BY_URL") {
            window.postMessage(
              {
                source: "job-search-assistant-extension",
                requestId: data.requestId,
                response: {
                  ok: true,
                  snapshot: {
                    title: "Senior Software Engineer - Acme Corp",
                    url: expectedUrl,
                    html,
                    text,
                  },
                },
              },
              "*",
            );
          }
        });
      },
      {
        expectedUrl: jobPostingUrl,
        html: `
          <div class="jobsearch-JobComponent">
            <div class="jobsearch-InfoHeaderContainer">
              <h1>Senior Software Engineer</h1>
              <div data-testid="inlineHeader-companyName"><a>Acme Corp</a></div>
              <div data-testid="job-location">Remote</div>
              <div data-testid="salaryInfoAndJobType"><span>$150,000 - $180,000 a year</span></div>
            </div>
          </div>
        `,
        text: "Senior Software Engineer\nAcme Corp\nRemote\n$150,000 - $180,000 a year",
      },
    );

    await page.goto("/");
    const urlInput = page.getByLabel("Posting URL");
    await urlInput.fill(jobPostingUrl);

    const [newPage] = await Promise.all([context.waitForEvent("page"), page.getByRole("button", { name: "Go", exact: true }).click()]);
    expect(newPage.url()).toBe(jobPostingUrl);

    await page.getByRole("button", { name: "Capture", exact: true }).click();
    await expect(page.locator(".job-postings-status")).toContainText("Captured Senior Software Engineer.");

    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.locator(".job-postings-status")).toContainText("Saved Senior Software Engineer");
    await expect(page.locator(".job-postings-saved-item")).toContainText("Senior Software Engineer");
    await expect(page.locator(".job-postings-saved-item")).toContainText("Acme Corp");
  });

  test("Scenario: Refresh loads saved job postings from the database", async ({ page }) => {
    const savedJobPostings = [
      {
        id: 42,
        title: "Senior Software Engineer",
        company: "Acme Corp",
        location: "Remote",
        salary: "$150,000 - $180,000 a year",
        workModel: "Remote",
        url: "https://example.com/jobs/senior-software-engineer",
        documentId: 99,
        createdAt: "2024-01-15T00:00:00Z",
        document: {
          id: 99,
          title: "Senior Software Engineer",
          type: "job-posting",
          content: "# Senior Software Engineer\n\nAcme Corp",
          source: "example.com",
        },
      },
    ];

    let fetches = 0;

    await page.route("**/api/v1/job-postings", async (route) => {
      fetches += 1;
      const responseBody = fetches === 1 ? [] : savedJobPostings;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responseBody),
      });
    });

    await page.goto("/");

    const savedJobPostingsContainer = page.locator("#job-postings--saved-job-postings--container");
    await savedJobPostingsContainer.locator("summary").click();

    const refreshButton = page.locator("#job-postings--saved-job-postings--refresh-button");
    await expect(refreshButton).toBeVisible();

    await refreshButton.click();

    await expect(page.locator(".job-postings-saved-item")).toHaveCount(1);
    await expect(page.locator(".job-postings-saved-item")).toContainText("Senior Software Engineer");
    await expect(page.locator(".job-postings-saved-item")).toContainText("Acme Corp");
    await expect(page.locator(".job-postings-saved-item")).toContainText("Remote");
    await expect(fetches).toBeGreaterThanOrEqual(2);
  });
});
