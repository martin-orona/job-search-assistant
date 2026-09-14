import { expect, test, TestInfo } from "@playwright/test";

function getTabTarget(page: Parameters<typeof test>[0]["page"], tabTarget: string) {
  if (tabTarget.startsWith("#") || tabTarget.startsWith(".")) {
    return page.locator(tabTarget);
  }

  return page.getByRole("tab", { name: tabTarget });
}

export function generateExpanderStateTests(expanderSelectors: string[], tabTarget: string) {
  for (const expanderSelector of expanderSelectors) {
    test(`Scenario: ${expanderSelector} - Expander restores its toggled state`, async ({ page }) => {
      await page.goto("/");

      const tab = getTabTarget(page, tabTarget);
      if (!(await tab.getAttribute("aria-selected")) || (await tab.getAttribute("aria-selected")) !== "true") {
        await tab.click();
      }

      await expect(tab).toHaveAttribute("aria-selected", "true");

      await verifyExpanderStateRestores(page, expanderSelector);
    });
  }

  async function verifyExpanderStateRestores(page: Parameters<typeof test>[0]["page"], selector: string) {
    const expander = page.locator(selector);
    const parentDetails = page.locator(`xpath=//*[@id='${selector.replace("#", "")}']/ancestor::details[1]`);
    const isVisible = await expander.isVisible().catch(() => false);

    if (!isVisible) {
      const detailsCount = await parentDetails.count();
      if (detailsCount > 0) {
        const details = parentDetails.first();
        const detailsOpen = await details.evaluate((element) => element.hasAttribute("open"));
        if (!detailsOpen) {
          await details.locator("> summary").click();
        }
      }
    }

    const summary = expander.locator("> summary");

    await expect(expander, `Control ${selector} should be visible before toggling.`).toBeVisible();

    const initialStateIsOpen = await expander.evaluate((element) => element.hasAttribute("open"));
    const targetStateIsOpen = !initialStateIsOpen;

    await summary.click();

    if (targetStateIsOpen) {
      await expect(
        expander,
        `Control ${selector} should toggle from ${initialStateIsOpen ? "open" : "closed"} to open after the user clicks it.`,
      ).toHaveAttribute("open");
    } else {
      await expect(
        expander,
        `Control ${selector} should toggle from ${initialStateIsOpen ? "open" : "closed"} to closed after the user clicks it.`,
      ).not.toHaveAttribute("open");
    }

    await page.reload();

    if (targetStateIsOpen) {
      await expect(
        expander,
        `Control ${selector} should restore its persisted open state after reload. Expected open but it remained closed.`,
      ).toHaveAttribute("open");
    } else {
      await expect(
        expander,
        `Control ${selector} should restore its persisted closed state after reload. Expected closed but it remained open.`,
      ).not.toHaveAttribute("open");
    }
  }
}

export function generateInputStateTests(inputSelectors: string[], tabTarget: string) {
  for (const inputSelector of inputSelectors) {
    test(`Scenario: ${inputSelector} - Input restores its value`, async ({ page }) => {
      await page.goto("/");

      const tab = getTabTarget(page, tabTarget);
      if (!(await tab.getAttribute("aria-selected")) || (await tab.getAttribute("aria-selected")) !== "true") {
        await tab.click();
      }

      await expect(tab).toHaveAttribute("aria-selected", "true");

      await verifyInputValueRestores(page, inputSelector);
    });
  }

  async function verifyInputValueRestores(page: Parameters<typeof test>[0]["page"], selector: string) {
    const input = page.locator(selector);
    const ancestorDetails = page.locator(`xpath=//*[@id='${selector.replace("#", "")}']/ancestor::details`);
    const isVisible = await input.isVisible().catch(() => false);

    if (!isVisible) {
      const detailsCount = await ancestorDetails.count();
      for (let i = 0; i < detailsCount; i += 1) {
        const details = ancestorDetails.nth(i);
        const detailsOpen = await details.evaluate((element) => element.hasAttribute("open"));
        if (!detailsOpen) {
          await details.locator("> summary").click();
        }
      }
    }

    await expect(input, `Control ${selector} should be visible before changing its value.`).toBeVisible({
      timeout: 15000,
    });

    const elementInfo = await input.evaluate((element) => {
      const htmlElement = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      return {
        tagName: htmlElement.tagName.toLowerCase(),
        type: "type" in htmlElement ? htmlElement.type : "",
        readOnly: "readOnly" in htmlElement ? htmlElement.readOnly : false,
        value: htmlElement.value,
      };
    });

    if (elementInfo.tagName === "select") {
      const targetValue = "HTML";
      await input.selectOption(targetValue);
      await expect(
        input,
        `Control ${selector} should accept the new value before reload. Expected ${targetValue} but found a different value.`,
      ).toHaveValue(targetValue);

      await page.reload();

      await expect(
        input,
        `Control ${selector} should restore its persisted value after reload. Expected ${targetValue} but the restored value did not match.`,
      ).toHaveValue(targetValue);

      return;
    }

    if (elementInfo.type === "checkbox") {
      const targetChecked = !(await input.isChecked());
      if (targetChecked) {
        await input.check();
      } else {
        await input.uncheck();
      }

      await expect(input, `Control ${selector} should toggle to ${targetChecked ? "checked" : "unchecked"} before reload.`).toBeChecked({
        checked: targetChecked,
      });

      await page.reload();

      await expect(
        input,
        `Control ${selector} should restore its persisted ${targetChecked ? "checked" : "unchecked"} state after reload.`,
      ).toBeChecked({ checked: targetChecked });

      return;
    }

    const targetValue = elementInfo.type === "date" ? "2024-12-31" : "persisted-input-value-12345";

    const isReadonly = elementInfo.readOnly;
    if (isReadonly) {
      const readonlyValue = await input.inputValue();

      await page.reload();

      await expect(
        input,
        `Control ${selector} should retain its readonly value after reload. Expected ${readonlyValue} but the value changed.`,
      ).toHaveValue(readonlyValue);

      return;
    }

    await input.fill(targetValue);
    await expect(
      input,
      `Control ${selector} should accept the new value before reload. Expected ${targetValue} but found a different value.`,
    ).toHaveValue(targetValue);

    await page.reload();

    await expect(
      input,
      `Control ${selector} should restore its persisted value after reload. Expected ${targetValue} but the restored value did not match.`,
    ).toHaveValue(targetValue);
  }
}

export async function initiateDbViewerTestFlow(page: any, testInfo: TestInfo) {
  const headers = getTestHeaders(testInfo);
  await page.setExtraHTTPHeaders(headers);
  // await page.context().addCookies([
  //   {
  //     name: "jsa_test_flow",
  //     value: TEST_FLOW_ID,
  //     url: "http://localhost:5173",
  //   },
  // ]);
}

export async function cleanupDbViewerTestFlow(page: any, testInfo: TestInfo) {
  await page.request.get("http://localhost:5000/clean-test-db", {
    headers: {
      "X-JSA-Test-Cleanup": "true",
      ...getTestHeaders(testInfo),
    },
  });
}

function getTestHeaders(testInfo: TestInfo) {
  const testPath = testInfo.titlePath.join(" > ");
  const testTitle = testPath
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
  const projectName = (testInfo.project.name || "default")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
  const uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const flowId = `${projectName}-${testTitle}-${uniqueSuffix}`;
  const cappedFlowId = flowId.length > 80 ? `${flowId.slice(0, 70)}-${Math.random().toString(36).slice(2, 8)}` : flowId;
  return {
    "X-JSA-Test-Flow": cappedFlowId,
  };
}

export async function callServer({
  page,
  testInfo,
  route,
  method,
  data,
}: {
  page: any;
  testInfo: TestInfo;
  route: string;
  method: "POST" | "PATCH";
  data: any;
}) {
  const testHeaders = getTestHeaders(testInfo);
  const response = await page.evaluate(sendToServer, { route, method, data, testHeaders });

  if (!response.ok) {
    throw new Error(`Failed to call the web server: ${response.status} ${JSON.stringify(response.json?.())}`);
  }

  return response;

  // NOTE: This function executes in the browser's context, not in the Node.js context.
  async function sendToServer({
    route,
    method,
    data,
    testHeaders,
  }: {
    route: string;
    method: "POST" | "PATCH";
    data: object;
    testHeaders: Record<string, string>;
  }) {
    const res = await fetch(`http://localhost:5000/api/v1/${route}`, {
      method,
      headers: {
        ...testHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    // NOTE: Evaluate here because passing a function out of the browser context would lose the ability to await the JSON parsing.
    const json = await res.json().catch(() => null);

    return {
      ok: res.ok,
      status: res.status,
      json: json,
      hasJson: json !== null,
    };
  }
}
