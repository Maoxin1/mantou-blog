const { defineConfig } = require('@playwright/test');
const path = require('node:path');
module.exports = defineConfig({
  testDir: '.', testMatch: 'overview.spec.cjs', fullyParallel: false, workers: 1, retries: 0, timeout: 15000,
  reporter: [['line'], ['json', { outputFile: 'playwright-report/overview/report.json' }]],
  use: { baseURL: 'http://127.0.0.1:4191', serviceWorkers: 'block', viewport: { width: 1280, height: 900 } },
  webServer: { command: `${process.platform === 'win32' ? 'py -3.12' : 'python'} -m http.server 4191 --directory public`, cwd: path.resolve(__dirname, '../..'), url: 'http://127.0.0.1:4191/', reuseExistingServer: false, timeout: 15000 },
});
