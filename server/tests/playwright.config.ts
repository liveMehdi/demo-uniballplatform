import { testOrigin } from "./environment.js";
import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: "./browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 45_000,
  expect: { timeout: 10_000 },

  outputDir: "../test-results",
  reporter: [
    ["list"],
    ["html", { outputFolder: "../playwright-report", open: "never" }],
  ],

  use: {
    baseURL: testOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: `"${process.execPath}" --import tsx tests/start-app.ts`,
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    url: `${testOrigin}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
  },
});
