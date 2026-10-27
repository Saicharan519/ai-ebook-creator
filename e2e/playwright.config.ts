import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the real API and web app against the test database,
 * with the fake AI provider so no real model is called. They use their own
 * ports, so they can run while `npm run dev` is up.
 */
const API_PORT = 8100;
const WEB_PORT = 5180;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  timeout: 60_000,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // NODE_ENV=test loads apps/api/.env.test (test database, fake AI); the
      // variables below take precedence over it, and CI's own environment does too
      command: "npx prisma migrate deploy && npx tsx src/server.ts",
      cwd: "../apps/api",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: {
        NODE_ENV: "test",
        PORT: String(API_PORT),
        PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
        AI_PROVIDER: "fake",
        LOG_LEVEL: "warn",
        UPLOAD_DIR: ".test-uploads",
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: "../apps/web",
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      env: { VITE_API_URL: `http://localhost:${API_PORT}` },
    },
  ],
});
