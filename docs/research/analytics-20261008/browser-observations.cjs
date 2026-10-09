/* Research instrumentation only. Routes every request to local files, a tiny
 * script stand-in, or an explicit abort. Never sends analytics to a provider.
 * It characterizes the existing loader; it is not a replacement beacon or an
 * end-to-end acceptance test for the provider's pipeline. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const repository = path.resolve(__dirname, '../../..');
const publicRoot = path.join(repository, 'public');
const loaderPath = path.join(repository, 'layouts/partials/analytics.html');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim();
assert.equal(commit, '39b51748776c4f723007b60c3c77893d16c8faf2');
assert.equal(fs.existsSync(path.join(publicRoot, 'index.html')), true, 'Run the recorded Hugo build first.');

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml' };

async function observe(browser, hostname, pathname, initialMode, actions) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  const beaconRequests = [];
  let mode = initialMode;
  page.on('pageerror', error => errors.push(error.message));
  await context.route('**/*', async route => {
    const target = new URL(route.request().url());
    if (target.hostname === 'static.cloudflareinsights.com' && target.pathname === '/beacon.min.js') {
      beaconRequests.push({ mode, resourceType: route.request().resourceType() });
      if (mode === 'blocked') return route.abort('blockedbyclient');
      return route.fulfill({ contentType: 'text/javascript', body: 'window.__researchBeaconStandInLoads = (window.__researchBeaconStandInLoads || 0) + 1;' });
    }
    if (target.hostname !== hostname) return route.abort('blockedbyclient');
    let resolved = path.resolve(publicRoot, '.' + decodeURIComponent(target.pathname));
    if (!resolved.startsWith(publicRoot + path.sep) && resolved !== publicRoot) return route.abort('accessdenied');
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) resolved = path.join(resolved, 'index.html');
    if (!fs.existsSync(resolved) && !path.extname(resolved)) resolved += '.html';
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return route.fulfill({ status: 404, body: 'Local research fixture not found' });
    return route.fulfill({ contentType: mime[path.extname(resolved)] || 'application/octet-stream', body: fs.readFileSync(resolved) });
  });

  try {
    await page.goto(`https://${hostname}${pathname}`, { waitUntil: 'load' });
    const first = await page.evaluate(() => ({
      loaders: document.querySelectorAll('[data-analytics-loader]').length,
      scripts: [...document.querySelectorAll('script[src]')].filter(script => script.src.includes('static.cloudflareinsights.com/beacon.min.js')).map(script => ({ type: script.type, hasSiteToken: Boolean(JSON.parse(script.dataset.cfBeacon || '{}').token) })),
      standInLoads: window.__researchBeaconStandInLoads || 0,
    }));
    assert.equal(await page.locator('h1').isVisible(), true);
    const result = { hostname, pathname, initialMode, first, beaconRequests, errors };
    if (actions === 'navigate') {
      await page.locator('#header-desktop a[href="/works/"]').click();
      assert.equal(new URL(page.url()).pathname, '/works/');
      assert.equal(await page.locator('[data-works-index]').isVisible(), true);
      result.navigation = '/works/';
    }
    if (actions === 'reload') {
      mode = 'stand-in';
      await page.reload({ waitUntil: 'load' });
      result.afterReload = await page.evaluate(() => ({ standInLoads: window.__researchBeaconStandInLoads || 0, scripts: document.querySelectorAll('script[src*="static.cloudflareinsights.com/beacon.min.js"]').length }));
      assert.equal(result.afterReload.standInLoads, 1);
    }
    assert.deepEqual(errors, []);
    return result;
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    const blocked = await observe(browser, 'mantou-blog.pages.dev', '/', 'blocked', 'navigate');
    assert.equal(blocked.first.scripts.length, 1);
    assert.equal(blocked.first.scripts[0].type, 'module');
    assert.equal(blocked.beaconRequests.length, 2, 'Each new document invokes its own loader.');
    const recovery = await observe(browser, 'mantou-blog.pages.dev', '/', 'blocked', 'reload');
    const preview = await observe(browser, 'manual-preview.mantou-blog.pages.dev', '/', 'stand-in');
    assert.equal(preview.first.loaders, 1);
    assert.equal(preview.first.scripts.length, 0);
    assert.equal(preview.beaconRequests.length, 0);
    const admin = await observe(browser, 'mantou-blog.pages.dev', '/admin/analytics/', 'stand-in');
    assert.equal(admin.first.loaders, 0);
    assert.equal(admin.beaconRequests.length, 0);

    const result = { recordedAt: new Date().toISOString(), commit, platform: process.platform,
      node: process.version, playwright: require('playwright/package.json').version, browser: browser.version(),
      loaderSha256: crypto.createHash('sha256').update(fs.readFileSync(loaderPath)).digest('hex'),
      externalNetwork: 'All requests intercepted; provider beacon not executed; service workers blocked.',
      observations: [blocked, recovery, preview, admin],
      limitations: ['Does not verify ingestion, private dashboards, counts, referrers or provider compatibility.',
        'Script success and recovery use a stand-in, not the provider script.',
        'Does not exercise search indexing, comments, offline service workers or other browser engines.'] };
    fs.writeFileSync(path.join(__dirname, 'browser-observations.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
    process.stdout.write('4 isolated observations passed; no provider requests sent.\n');
  } finally {
    await browser.close();
  }
})().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
