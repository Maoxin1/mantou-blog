const { test, expect } = require('@playwright/test');

async function waitForServiceWorkerControl(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
    });
  });
}

test('已访问作品断网可读，未访问路径显示离线说明', async ({ page, context }) => {
  const visitedWork = '/works/mantou-checklist-pwa/';
  await page.goto(visitedWork, { waitUntil: 'load' });
  await waitForServiceWorkerControl(page);

  // Reload once under Service Worker control so the navigation is cached.
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator('[data-work-detail]')).toBeVisible();

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-work-detail]')).toBeVisible();

    await page.goto('/edge-case-never-cached/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '🥯 当前处于离线状态' })).toBeVisible();
    await expect(page.getByText('已经浏览过的文章仍可从缓存中打开')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('所有后台入口和配置都不进入 PWA 缓存', async ({ page, context }) => {
  await page.goto('/', { waitUntil: 'load' });
  await waitForServiceWorkerControl(page);

  const adminPaths = [
    '/admin/',
    '/admin/config.yml?cache-boundary=1',
    '/admin/sveltia/',
    '/admin/sveltia/config.yml?cache-boundary=1',
  ];

  const onlineStatuses = await page.evaluate(async (paths) => Promise.all(
    paths.map(async (path) => {
      const response = await fetch(path, { cache: 'no-store' });
      return response.status;
    }),
  ), adminPaths);
  expect(onlineStatuses).toEqual(adminPaths.map(() => 200));

  await context.setOffline(true);
  try {
    const offlineResults = await page.evaluate(async (paths) => Promise.all(
      paths.map(async (path) => {
        try {
          await fetch(path, { cache: 'no-store' });
          return 'unexpected-cache-hit';
        } catch {
          return 'network-failed';
        }
      }),
    ), adminPaths);
    expect(offlineResults).toEqual(adminPaths.map(() => 'network-failed'));
  } finally {
    await context.setOffline(false);
  }
});
