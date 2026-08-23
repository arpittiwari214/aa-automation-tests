// playwright.config.js
//
// Two projects, one per use case, so each can be run on its own:
//   npm run test:usecase1   -> browser-driven UI tests
//   npm run test:usecase2   -> pure HTTP API tests (no browser launched)

require('dotenv').config();
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL =
  process.env.AA_BASE_URL || 'https://community.cloud.automationanywhere.digital';

module.exports = defineConfig({
  testDir: './tests',
  // The AA Community Edition control room is slow to boot its editors,
  // so the default 30s is not enough for the form-builder specs.
  timeout: 90 * 1000,
  expect: { timeout: 15 * 1000 },
  retries: process.env.CI ? 1 : 0,
  // Serial: Community Edition allows a single active session per user,
  // so parallel workers would fight over the same login.
  workers: 1,
  fullyParallel: false,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 20 * 1000,
    navigationTimeout: 45 * 1000,
  },

  projects: [
    {
      name: 'usecase1-ui',
      testMatch: /useCase1\.spec\.js/,
      use: {
        ...devices['Desktop Chrome'],
        // Headless by default. Set HEADED=1 to watch the run in a real window:
        //   HEADED=1 npm run test:usecase1      (bash)
        //   $env:HEADED=1; npm run test:usecase1  (PowerShell)
        headless: process.env.HEADED !== '1',
        viewport: { width: 1600, height: 900 },
      },
    },
    {
      name: 'usecase2-api',
      testMatch: /useCase2\.spec\.js/,
      // No browser needed — these specs only use the `request` fixture.
    },
  ],
});
