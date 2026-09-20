const { defineConfig, devices } = require('@playwright/test');

const pythonCommand = process.platform === 'win32' ? 'py -3.12' : 'python';

module.exports = defineConfig({
  testDir: './tests/e2e',
  // PWA and deferred enhancement checks share one local origin. Keep the local
  // run aligned with CI so service-worker and script-readiness tests cannot race.
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `${pythonCommand} -m http.server 4174 --directory public`,
    url: 'http://127.0.0.1:4174/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
