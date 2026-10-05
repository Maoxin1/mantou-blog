const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/smoke',
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  timeout: 30_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-smoke', open: 'never' }],
  ],
  use: {
    baseURL: process.env.SMOKE_BASE_URL || 'https://mantou-blog.pages.dev',
    ...devices['Desktop Chrome'],
    launchOptions: process.env.MANTOU_CHROMIUM_PATH ? {
      executablePath: process.env.MANTOU_CHROMIUM_PATH,
    } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
