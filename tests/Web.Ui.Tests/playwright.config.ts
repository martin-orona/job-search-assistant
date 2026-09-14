import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webUiDir = path.resolve(__dirname, "../../src/Web.Ui");
const serverDir = path.resolve(__dirname, "../../src/Server");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: {
    timeout: 2000,
  },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    actionTimeout: 2000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
  ],
  webServer: [
    {
      command: "dotnet run --project Server.csproj",
      cwd: serverDir,
      url: "http://localhost:5000/",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        ASPNETCORE_ENVIRONMENT: "Development",
      },
    },
    {
      command: "pnpm dev",
      cwd: webUiDir,
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
