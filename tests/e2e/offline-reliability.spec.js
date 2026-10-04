const { test, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

// Inject failures at the HTTP server, not Playwright routing: requests issued by
// the service worker must see the same 503/hang that a real upstream would return.
const publicDirectory = path.resolve('public');
const articlePath = '/works/mantou-checklist-pwa/';
const assetPath = '/offline-reliability-asset.js';
const bootstrapPath = '/offline-reliability-bootstrap.html';
const faults = new Map();
const requestCounts = new Map();
const sockets = new Set();
let server;
let origin;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

test.beforeAll(async () => {
  server = http.createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      requestCounts.set(pathname, (requestCounts.get(pathname) || 0) + 1);
      // Prevent the browser's HTTP cache from masking the injected network fault.
      response.setHeader('Cache-Control', 'no-store');
      const fault = faults.get(pathname);
      if (fault === 'hang') return;
      if (fault) {
        if (fault.delay) await new Promise((resolve) => setTimeout(resolve, fault.delay));
        response.writeHead(fault.status, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(fault.body || 'Injected upstream failure');
        return;
      }
      if (pathname === bootstrapPath) {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('<!doctype html><html><title>Worker setup</title><body>Worker setup</body></html>');
        return;
      }
      if (pathname === assetPath) {
        response.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        response.end('/* original cached asset */');
        return;
      }
      const relative = decodeURIComponent(pathname).replace(/^\/+/, '');
      const filename = path.resolve(publicDirectory, relative, pathname.endsWith('/') ? 'index.html' : '');
      if (!filename.startsWith(publicDirectory + path.sep)) {
        response.writeHead(403);
        response.end();
        return;
      }
      const body = await fs.readFile(filename);
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filename)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      if (!response.headersSent) response.writeHead(404);
      response.end('Not found');
    }
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(() => {
  faults.clear();
  requestCounts.clear();
});

test.afterAll(async () => {
  for (const socket of sockets) socket.destroy();
  if (server) await new Promise((resolve) => server.close(resolve));
});

async function installWorker(page) {
  await page.goto(origin + bootstrapPath);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
    });
  });
}

async function readCached(page, pathname) {
  return page.evaluate(async (pathname) => {
    const names = (await caches.keys()).filter((name) => name.startsWith('mantou-blog-'));
    for (const name of names) {
      const cache = await caches.open(name);
      const response = await cache.match(pathname);
      if (response) return { status: response.status, body: await response.text() };
    }
    return null;
  }, pathname);
}

async function cacheArticle(page) {
  await installWorker(page);
  await page.goto(origin + articlePath, { waitUntil: 'load' });
  await expect(page.locator('[data-work-detail]')).toBeVisible();
  await expect.poll(async () => (await readCached(page, articlePath))?.status).toBe(200);
}

test('已缓存正文经历 200 → 503 → 断网仍可阅读', async ({ page, context }) => {
  await cacheArticle(page);
  const original = await readCached(page, articlePath);
  const before = requestCounts.get(articlePath);
  faults.set(articlePath, { status: 503 });

  const response = await page.reload({ waitUntil: 'domcontentloaded' });
  expect(response.status()).toBe(200);
  await expect(page.locator('[data-work-detail]')).toBeVisible();
  expect(requestCounts.get(articlePath)).toBeGreaterThan(before);
  expect(await readCached(page, articlePath)).toEqual(original);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-work-detail]')).toBeVisible();
    expect(await readCached(page, articlePath)).toEqual(original);
  } finally {
    await context.setOffline(false);
  }
});

test('未缓存页面的 503 按语言回退，错误内容不入缓存', async ({ page }) => {
  await installWorker(page);
  for (const pathname of ['/never-cached-upstream/', '/en/never-cached-upstream/']) {
    faults.set(pathname, { status: 503 });
    await page.goto(origin + pathname, { waitUntil: 'domcontentloaded' });
    if (pathname.startsWith('/en/')) {
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.locator('h1')).toContainText('offline');
    } else {
      await expect(page.getByRole('heading', { name: '🥯 当前处于离线状态' })).toBeVisible();
    }
    expect(requestCounts.get(pathname)).toBeGreaterThan(0);
    expect(await readCached(page, pathname)).toBeNull();
  }
});

test('网络挂起时在有界等待后回退正文或对应语言离线页', async ({ page }) => {
  await cacheArticle(page);
  faults.set(articlePath, 'hang');
  let start = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 10_000 });
  expect(Date.now() - start).toBeLessThan(9000);
  await expect(page.locator('[data-work-detail]')).toBeVisible();

  const uncachedPath = '/en/never-cached-timeout/';
  faults.set(uncachedPath, 'hang');
  start = Date.now();
  await page.goto(origin + uncachedPath, { waitUntil: 'domcontentloaded', timeout: 10_000 });
  expect(Date.now() - start).toBeLessThan(9000);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toContainText('offline');
  expect(await readCached(page, uncachedPath)).toBeNull();
});

test('静态资源后台刷新不以 503 覆盖成功版本，恢复后可更新', async ({ page }) => {
  await installWorker(page);
  const fetchAsset = () => page.evaluate(async (pathname) => (await fetch(pathname)).text(), assetPath);
  expect(await fetchAsset()).toBe('/* original cached asset */');
  await expect.poll(async () => (await readCached(page, assetPath))?.body).toBe('/* original cached asset */');

  faults.set(assetPath, { status: 503 });
  const before = requestCounts.get(assetPath);
  expect(await fetchAsset()).toBe('/* original cached asset */');
  await expect.poll(() => requestCounts.get(assetPath)).toBeGreaterThan(before);
  expect((await readCached(page, assetPath)).body).toBe('/* original cached asset */');

  faults.set(assetPath, { status: 200, body: '/* refreshed asset */', delay: 150 });
  expect(await fetchAsset()).toBe('/* original cached asset */');
  await expect.poll(async () => (await readCached(page, assetPath))?.body).toBe('/* refreshed asset */');
});

test('激活只清理本站旧版本，保留同源其他应用缓存', async ({ page }) => {
  await page.goto(origin + bootstrapPath);
  await page.evaluate(async () => {
    for (const name of ['mantou-blog-obsolete-test', 'other-app-preserve-test']) {
      const cache = await caches.open(name);
      await cache.put('/cache-marker', new Response(name));
    }
  });
  await installWorker(page);
  const names = await page.evaluate(() => caches.keys());
  expect(names).not.toContain('mantou-blog-obsolete-test');
  expect(names).toContain('other-app-preserve-test');
  expect(names.some((name) => name.startsWith('mantou-blog-'))).toBe(true);
  expect(await page.evaluate(async () => {
    const cache = await caches.open('other-app-preserve-test');
    return (await cache.match('/cache-marker')).text();
  })).toBe('other-app-preserve-test');
});
