import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration.
 * Run `npm run test:e2e` to execute all E2E tests.
 * Run `npm run test:e2e:ui` for the interactive UI mode.
 *
 * The dev server is started automatically before tests run (webServer config below).
 *
 * We run through `netlify dev` (port 8888) rather than plain `astro dev`
 * (port 4321) because tests/e2e/join.spec.ts exercises the Netlify Functions
 * (/.netlify/functions/create-checkout, stripe-webhook) that only `netlify
 * dev`'s proxy serves. netlify.toml's [dev] block pins targetPort=4321 so
 * Astro's own server and the Netlify proxy don't collide.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:8888',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'npx netlify dev',
    url: 'http://localhost:8888',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
