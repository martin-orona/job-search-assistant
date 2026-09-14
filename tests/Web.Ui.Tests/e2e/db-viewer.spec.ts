import { expect, Locator, Page, test, TestInfo } from "@playwright/test";
import { callServer, cleanupDbViewerTestFlow, initiateDbViewerTestFlow } from "./helpers";

namespace DbViewer {
  test.describe("Feature: DB Viewer", () => {
    test.beforeEach(async ({ page, context, browser, request }, testInfo) => {
      console.log("Setting up for test:", testInfo.title, testInfo.testId);
      await initiateDbViewerTestFlow(page, testInfo);
      await cleanupDbViewerTestFlow(page, testInfo);
    });

    test.afterEach(async ({ page }, testInfo) => {
      await cleanupDbViewerTestFlow(page, testInfo);
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

    test("Scenario: Refresh failure for a DB Viewer tab is visible to the user", async ({ page }) => {
      await page.goto("/");
      await page.getByRole("tab", { name: "DB Viewer" }).click();

      await page.route("**/api/v1/job-postings**", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({
            status: 500,
            contentType: "text/plain",
            body: "Job posting refresh failed",
          });
        }
      });

      await page.locator("#db-viewer--job-postings--refresh-button").click();

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

      async function runTest_listIsVisible({ page, testInfo, config }: { page: Page; testInfo: TestInfo; config: LocalEntityConfig }) {
        const entityId = await seedTheDatabase({ page, testInfo, seeds: config.seeds });

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();

        await expandSection({ page, config });

        const expander = page.locator(config.container());

        await expect(expander).toBeVisible();
        await expect(expander).toContainText(config.name);

        await expect(page.locator(config.controlId("count"))).toContainText("1 saved");
        await expect(page.locator(config.controlId("refresh-button"))).toBeVisible();

        await expect(page.locator(config.controlId("list"))).toBeVisible();

        await expect(page.locator(config.recordControlId(entityId, "editor--id"))).toContainText(String(entityId));
        await expect(page.locator(config.recordControlId(entityId, config.checkField))).toContainText(
          config.seeds.primary.data[config.checkFieldObjectKey],
        );
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

          await expect(row.locator(config.recordControlId(record.id, "editor--id"))).toBeVisible();
          await assertIsNotLinked(page, config.recordControlId(record.id, "editor--title"));
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

          await expect(row.locator(config.recordControlId(record.id, "editor--id"))).toBeVisible();
          await assertIsNotLinked(page, config.recordControlId(record.id, "editor--name"));
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

          await expect(row.locator(config.recordControlId(record.id, "editor--id"))).toBeVisible();
          await assertIsNotLinked(page, config.recordControlId(record.id, "editor--name"));
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

          await expect(row.locator(config.recordControlId(record.id, "editor--id"))).toBeVisible();
          await assertIsNotLinked(page, config.recordControlId(record.id, "editor--name"));

          await expect(row.locator("a.db-viewer-list-item-read-header-link")).toHaveCount(3);
          await assertIsLinked(page, config.recordControlId(record.id, "editor--job-posting--display--title"));
          await assertIsLinked(page, config.recordControlId(record.id, "editor--resume--display--name"));
          await assertIsLinked(page, config.recordControlId(record.id, "editor--ai-prompt-template--display--name"));
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

        await config.assert({ page, config });
      }
    });

    test.describe("Scenario: Referenced records link back to referencing records", () => {
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

          const row = page.locator(config.recordId(record.id));
          await expect(row).toBeVisible();

          const recordRow = page.locator(config.recordId(record.id));
          await expect(recordRow).toContainText("Referenced By");

          await verifyBackReferenceWorks(page, recordRow, aiPrompt as { id: number; name: string });
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
        const entityId = await seedTheDatabase({ page, testInfo, seeds: config.seeds });

        await page.goto("/");
        await page.getByRole("tab", { name: "DB Viewer" }).click();

        await page.locator(config.container()).scrollIntoViewIfNeeded();

        await expandSection({ page, config });

        const recordId = config.recordId(entityId);

        const row = page.locator(recordId);

        await expect(row).toBeVisible();

        await config.assert({ page, config });

        // const jobPostingRow = page.locator("#db-viewer--job-postings--record-9");
        // const referenceLink = jobPostingRow.locator("a[href='#db-viewer--ai-prompts--record-101']");

        // await expect(jobPostingRow).toContainText("Referenced By");
        // await expect(referenceLink).toContainText("AI Prompt 101 · Prompt 101");
        // await referenceLink.click();
        // await expect(page.locator("#db-viewer--ai-prompts--container")).toHaveAttribute("open", "");
        // await expect(page.locator("#db-viewer--ai-prompts--record-101")).toBeVisible();
      }

      async function verifyBackReferenceWorks(page: Page, jobPostingRow: Locator, aiPrompt: { id: number; name: string }) {
        const referenceId = `#db-viewer--ai-prompts--record-${aiPrompt.id}`;
        const referenceLink = jobPostingRow.locator(`a[href='${referenceId}']`);
        await expect(referenceLink).toContainText(`AI Prompt ${aiPrompt.id} · ${aiPrompt.name}`);

        await referenceLink.click();

        await expect(page.locator("#db-viewer--ai-prompts--container")).toHaveAttribute("open", "");
        await expect(page.locator(referenceId)).toBeVisible();
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

      async function assert({ page, config }: InternalTestActionParams) {
        const original = config.seeds.primary.data;
        const record = config.seeds.primary.created;

        if (!record?.id) {
          throw new Error("Initial record ID not available.");
        }

        const row = page.locator(config.recordId(record.id));
        await expect(row).toBeVisible();

        const verify = buildEditorDisplayVerifier({ page, config, original, record });
        await verify("id", record.id.toString());
        await verify((config as LocalEntityConfig).updateField, `${original[(config as LocalEntityConfig).updateField]} :: Updated`);
      }
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

          const verifyDisplay = buildEditorDisplayVerifier({ page, config, original, record });
          await verifyDisplay("title", "Staff Platform Engineer");
          await verifyDisplay("company", "Fabrikam");
          await verifyDisplay("location", "Austin, TX");
          await verifyDisplay("salary", "$175,000");
          await verifyDisplay("work-model", "Hybrid");
          await verifyDisplay("url", "https://example.com/job/platform");
          await verifyDisplay("document--display--type", "html");
          await verifyDisplay("document--display--content", "<h1>Staff Platform Engineer</h1>");

          // make sure that title is visible
          await expect(page.locator(buildEditorFieldId({ field: "title", recordId: record.id }))).toBeVisible();
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

          const verifyDisplay = buildEditorDisplayVerifier({ page, config, original, record });
          await verifyDisplay("name", "Platform Resume");
          await verifyDisplay("job-title", "Staff Platform Engineer");
          await verifyDisplay("date", "2026-02-20");
          await verifyDisplay("document--display--type", "html");
          await verifyDisplay("document--display--content", "<h1>Platform Resume</h1>");

          // make sure that name is visible
          await expect(page.locator(buildEditorFieldId({ field: "name", recordId: record.id }))).toBeVisible();
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

          const verifyDisplay = buildEditorDisplayVerifier({ page, config, original, record });
          await verifyDisplay("name", "Platform Interview Template");
          await verifyDisplay("document--display--type", "html");
          await verifyDisplay("document--display--content", "<h1>Assess the candidate's platform engineering experience.</h1>");

          // make sure that name is visible
          await expect(page.locator(buildEditorFieldId({ field: "name", recordId: record.id }))).toBeVisible();
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

        async function arrange({ page, config, buildEditorVerifier, buildEditorDisplayVerifier }: InternalTestActionParams) {
          const original = config.seeds.primary.data;
          const record = config.seeds.primary.created;

          if (!record) {
            throw new Error("Initial record not created.");
          }

          if (!record.id) {
            throw new Error("Initial record ID not available.");
          }

          const verify = buildEditorVerifier({ page, config, original, record });
          await verify("id", record.id.toString());
          await verify("name");
          await verify("ai-url", original.aiUrl);
          const aiPromptRecord = record as EntityRecord & {
            jobPostingId?: number;
            resumeId?: number;
            aiPromptTemplateId?: number;
          };
          await verify("job-posting--id", String(aiPromptRecord.jobPostingId));
          await verify("resume--id", String(aiPromptRecord.resumeId));
          await verify("ai-prompt-template--id", String(aiPromptRecord.aiPromptTemplateId));
          const verifyDisplay = buildEditorDisplayVerifier({ page, config, original, record });
          await verifyDisplay("job-posting--display--title", original.jobPosting?.title);
          await verifyDisplay("job-posting--display--company", original.jobPosting?.company);
          await verifyDisplay("job-posting--display--work-model", original.jobPosting?.workModel);
          await verifyDisplay("job-posting--display--salary", original.jobPosting?.salary);
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

          // make sure that name is visible
          await expect(page.locator(buildEditorFieldId({ field: "name", recordId: record.id }))).toBeVisible();
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
      };

      test(`Entity: Job Posting`, async ({ page }: { page: Page }, testInfo: TestInfo) => {
        const config = {
          entity: "Job Posting",
          ...build_common_entity({
            build_id: (segments: string[]) => build_tab_id(["job-postings", ...segments]),
          }),
          editField: "title",
          editFieldObjectKey: "title",

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
        await page.locator(editFieldId).fill(editValue + " :: Updated");

        await page.locator(config.cancelButtonId(entityId)).click();

        await expect(page.locator(config.formId())).not.toBeVisible();
        const actualValue = await page.locator(editFieldId).textContent();
        await expect(actualValue).toBe(editValue);
        await expect(actualValue).not.toBe(editValue + " :: Updated");
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
    await verifyDisplayField({ page, config, testInfo, elementId, expectedValue });
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

  async function seedTheDatabase({ page, testInfo, seeds }: { page: Page; testInfo: TestInfo; seeds: Record<string, EntitySeed> }) {
    for (const [_, seed] of Object.entries(seeds)) {
      const response = await callServer({
        page,
        testInfo,
        route: seed.route,
        method: "POST",
        data: seed.data,
      });

      seed.created = response.json;
    }

    const entityId = seeds["primary"]?.created?.id;
    return entityId;
  }
}
