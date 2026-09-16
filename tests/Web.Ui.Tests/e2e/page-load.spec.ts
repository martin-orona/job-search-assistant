import { expect, test } from "@playwright/test";

test.describe("Web.Ui page load", () => {
  test("should load the page and display main navigation", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/web-ui/i);
    await expect(page.getByRole("tab", { name: "Job Postings" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Resume Analyzer" })).toBeVisible();
  });
});
