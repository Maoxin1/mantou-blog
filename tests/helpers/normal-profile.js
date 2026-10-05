const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

// Installation checks need a normal Chromium context; incognito cannot install.
// Keep Playwright's tracing hooks and use a fresh disposable profile each time.
async function withNormalProfile(chromium, testInfo, check) {
  const profileRoot = await fs.realpath(os.tmpdir());
  const userDataDir = await fs.mkdtemp(path.join(profileRoot, 'mantou-install-check-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      ...testInfo.project.use.launchOptions,
      headless: true,
      viewport: { width: 1280, height: 800 },
      baseURL: testInfo.project.use.baseURL,
    });
    await check(context.pages()[0], context);
  } finally {
    try {
      if (context) await context.close();
    } finally {
      if (path.dirname(userDataDir) !== profileRoot || !path.basename(userDataDir).startsWith('mantou-install-check-')) {
        throw new Error('Unexpected installation profile cleanup path');
      }
      await fs.rm(userDataDir, { recursive: true, force: true });
    }
  }
}

module.exports = { withNormalProfile };
