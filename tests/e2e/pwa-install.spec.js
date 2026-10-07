const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

async function blockRealInstallPrompts(page) {
  await page.addInitScript(() => {
    window.addEventListener('beforeinstallprompt', event => {
      if (!event.__testPrompt) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  });
}
async function setDevice(page, userAgent) {
  await page.addInitScript(ua => {
    Object.defineProperty(navigator, 'userAgent', { get: () => ua });
  }, userAgent);
}
async function fakePrompt(page, outcome = 'accepted') {
  await page.evaluate(outcome => {
    window.__promptCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.__testPrompt = true;
    event.prompt = async () => { window.__promptCalls++; };
    event.userChoice = Promise.resolve({ outcome });
    window.dispatchEvent(event);
  }, outcome);
}

test.beforeEach(async ({ page }) => { await blockRealInstallPrompts(page); });

test('Android Chrome has a visible mobile install entry and menu fallback', async ({ page }) => {
  await setDevice(page, 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/154.0.0.0 Mobile Safari/537.36');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const button = page.locator('[data-pwa-placement="mobile"]');
  await expect(button).toBeVisible();
  await button.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-pwa-guide="android"]')).toBeVisible();
  await expect(dialog).toContainText('安装并创建快捷方式');
  await expect(dialog).toContainText('安装应用');
  await expect(dialog).toContainText('添加到主屏幕');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
});

test('an eligible Android click invokes only the captured native prompt', async ({ page }) => {
  await setDevice(page, 'Mozilla/5.0 (Linux; Android 15) Chrome/154.0.0.0 Mobile');
  await page.goto('/');
  await expect(page.locator('[data-pwa-placement="footer"]')).toBeVisible();
  await fakePrompt(page);
  await page.locator('[data-pwa-placement="footer"]').click();
  await expect.poll(() => page.evaluate(() => window.__promptCalls)).toBe(1);
  await expect(page.locator('[data-pwa-install]:visible')).toHaveCount(0);
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('dismissal keeps a usable manual guide without replaying the consumed prompt', async ({ page }) => {
  await page.goto('/');
  const button = page.locator('[data-pwa-placement="footer"]');
  await expect(button).toBeVisible();
  await fakePrompt(page, 'dismissed');
  await button.click();
  await expect.poll(() => page.evaluate(() => window.__promptCalls)).toBe(1);
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.__promptCalls)).toBe(1);
});

test('iPhone receives Safari instructions instead of an unavailable native prompt', async ({ page }) => {
  await setDevice(page, 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile Safari/604.1');
  await page.goto('/');
  await page.locator('[data-pwa-placement="footer"]').click();
  await expect(page.locator('[data-pwa-guide="ios"]')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('分享');
  await expect(page.getByRole('dialog')).toContainText('作为网页 App 打开');
});

test('embedded browsers receive a clean public link and browser instructions', async ({ page }) => {
  await setDevice(page, 'Mozilla/5.0 (Linux; Android 15) MicroMessenger/8.0.0');
  await page.goto('/en/');
  await page.locator('[data-pwa-placement="footer"]').click();
  await expect(page.locator('[data-pwa-guide="embedded"]')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Open in your browser first');
  const address = await page.locator('#pwa-install-url').inputValue();
  const url = new URL(address);
  expect(url.pathname).toBe('/en/');
  expect(url.search).toBe('');
  expect(url.username).toBe('');
});

test('standalone apps do not display redundant install controls', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }); });
  await page.goto('/');
  await expect(page.locator('[data-pwa-install]:visible')).toHaveCount(0);
});

test('unsupported dialog elements stay closed and can open and close the fallback', async ({ page }) => {
  // An unknown element has neither native dialog methods nor UA closed styling.
  // Removing showModal alone would retain that styling and mask the regression.
  await page.route('**/', async route => {
    if (route.request().resourceType() !== 'document'
        || new URL(route.request().url()).pathname !== '/') return route.fallback();
    const response = await route.fetch();
    const body = (await response.text()).replace(/<dialog\b/, '<pwa-dialog')
      .replace(/<\/dialog>/, '</pwa-dialog>');
    await route.fulfill({ response, body });
  });
  await page.goto('/');
  const button = page.locator('[data-pwa-placement="footer"]');
  const dialog = page.locator('#pwa-install-dialog');
  await expect(button).toBeVisible();
  expect(await dialog.evaluate(element => typeof element.showModal)).toBe('undefined');
  await expect(dialog).not.toBeVisible();
  await button.click();
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-pwa-close]').click();
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
});

test('actual HTTP redirects in cached offline pages still produce bilingual fallback', async ({ page, context }) => {
  const site = path.resolve('public');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const server = http.createServer((request, response) => {
    let pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/offline.html' || pathname === '/en/offline.html') {
      response.writeHead(308, { Location: pathname.slice(0, -5) });
      return response.end();
    }
    if (pathname === '/offline' || pathname === '/en/offline') pathname += '.html';
    const file = path.resolve(site, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(site + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404); return response.end();
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  try {
    await page.goto(origin + '/');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (navigator.serviceWorker.controller) return;
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    });
    expect(await page.evaluate(async () => {
      const names = (await caches.keys()).filter(name => name.startsWith('mantou-blog-'));
      return (await (await caches.open(names[0])).match('/offline.html')).redirected;
    })).toBe(true);
    await context.setOffline(true);
    await page.goto(origin + '/never-cached/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('当前处于离线状态');
    await page.goto(origin + '/en/never-cached/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('offline');
  } finally {
    await context.setOffline(false);
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
