const { test, expect } = require('@playwright/test');

const productionRoutes = [
  { path: '/', marker: '[data-portfolio-home]' },
  { path: '/works/', marker: '[data-works-index]' },
  { path: '/works/mantou-checklist-pwa/', marker: '[data-work-detail]' },
  { path: '/about/', marker: '[data-about-collaboration]' },
  { path: '/search/', marker: '#search' },
];

test('正式域名的关键路径与资源可以访问', async ({ page }) => {
  for (const route of productionRoutes) {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response, `${route.path} 应返回响应`).not.toBeNull();
    expect(response.status(), `${route.path} 应成功加载`).toBeLessThan(400);
    await expect(page.locator(route.marker)).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      /^https:\/\/mantou-blog\.pages\.dev\//,
    );
  }
});

test('正式搜索可以找到并打开代表作品', async ({ page }) => {
  await page.goto('/search/', { waitUntil: 'domcontentloaded' });
  const searchbox = page.getByRole('textbox', { name: '搜索文章…' });
  await expect(searchbox).toBeVisible();
  await searchbox.fill('定投清单');

  const result = page.locator('a.pagefind-ui__result-link', {
    hasText: '把个人定投清单做成可离线运行的手机 PWA',
  });
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(result).toHaveAttribute('href', /\/works\/mantou-checklist-pwa\/?$/);
  await result.click();
  await expect(page).toHaveURL(/\/works\/mantou-checklist-pwa\/$/);
  await expect(page.locator('[data-work-detail]')).toBeVisible();
});

test('公开案例链接指向的清单编辑器仍可完成核心入口加载', async ({ page }) => {
  const artifactURL = process.env.SMOKE_ARTIFACT_URL || 'https://mantou-checklist.pages.dev/editor';
  const response = await page.goto(artifactURL, { waitUntil: 'domcontentloaded' });

  expect(response, '清单编辑器应返回响应').not.toBeNull();
  expect(response.status(), '清单编辑器应成功加载').toBeLessThan(400);
  await expect(page).toHaveTitle(/个人定投清单/);
  await expect(page.locator('#checklist-form')).toBeVisible();
  await expect(page.locator('#download-button')).toBeVisible();
});

test('正式内容后台能够加载并读取PR发布配置', async ({ page, request }) => {
  const response = await page.goto('/admin/', { waitUntil: 'domcontentloaded' });
  expect(response, '后台入口应返回响应').not.toBeNull();
  expect(response.status(), '后台入口应成功加载').toBeLessThan(400);
  await expect(page.locator('#cms-error')).toBeHidden();
  await expect(page.getByRole('button', { name: /login with github/i })).toBeVisible({
    timeout: 20_000,
  });

  const configResponse = await request.get('/admin/config.yml');
  expect(configResponse.ok()).toBeTruthy();
  const config = await configResponse.text();
  const backend = config.split(/^media_folder:/m, 1)[0];
  expect(config).toMatch(/^publish_mode:\s*editorial_workflow\s*$/m);
  expect(backend).toMatch(/^\s+squash_merges:\s*true\s*$/m);
});

test('正式 Sveltia 灰度后台可用且所有后台资源禁止缓存', async ({ page, request }) => {
  const response = await page.goto('/admin/sveltia/', { waitUntil: 'domcontentloaded' });
  expect(response, 'Sveltia 灰度后台应返回响应').not.toBeNull();
  expect(response.status()).toBeLessThan(400);
  await expect(page.locator('#cms-error')).toBeHidden();
  await expect(page.getByRole('button', { name: /github/i })).toBeVisible({ timeout: 20_000 });

  for (const path of [
    '/admin/',
    '/admin/config.yml?production-cache-check=1',
    '/admin/sveltia/',
    '/admin/sveltia/config.yml?production-cache-check=1',
  ]) {
    const resource = await request.get(path);
    expect(resource.ok(), `${path} 应能从生产环境读取`).toBeTruthy();
    expect(resource.headers()['cache-control'], `${path} 必须禁止缓存`).toContain('no-store');
  }
});
