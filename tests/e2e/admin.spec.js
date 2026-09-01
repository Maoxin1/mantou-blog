const { test, expect } = require('@playwright/test');

test('内容后台加载并提供受保护的 GitHub 登录入口', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  const response = await page.goto('/admin/', { waitUntil: 'domcontentloaded' });
  expect(response, '后台入口应返回响应').not.toBeNull();
  expect(response.status(), '后台入口应成功加载').toBeLessThan(400);

  await expect(page.locator('#cms-error')).toBeHidden();
  await expect(page.getByRole('button', { name: /login with github/i })).toBeVisible({
    timeout: 20_000,
  });
  expect(runtimeErrors).toEqual([]);
});

test('公开的后台配置固定使用 PR 发布工作流', async ({ request }) => {
  const response = await request.get('/admin/config.yml');
  expect(response.ok()).toBeTruthy();

  const config = await response.text();
  expect(config).toMatch(/^publish_mode:\s*editorial_workflow\s*$/m);
  expect(config).toMatch(/^\s+squash_merges:\s*true\s*$/m);
  expect(config).toMatch(/^\s+branch:\s*main\s*$/m);
});

test('Sveltia 灰度后台复用受保护配置并提供 GitHub 登录入口', async ({ page }) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  const response = await page.goto('/admin/sveltia/', { waitUntil: 'domcontentloaded' });
  expect(response, 'Sveltia 灰度入口应返回响应').not.toBeNull();
  expect(response.status(), 'Sveltia 灰度入口应成功加载').toBeLessThan(400);

  await expect(page.locator('#cms-error')).toBeHidden();
  await expect(page.getByRole('button', { name: /github/i })).toBeVisible({ timeout: 20_000 });
  expect(runtimeErrors).toEqual([]);
});

test('Sveltia 主 CDN 失败后会改用固定版本的备用 CDN', async ({ page }) => {
  await page.route(
    'https://unpkg.com/@sveltia/cms@0.203.2/dist/sveltia-cms.js',
    (route) => route.abort('failed'),
  );

  await page.goto('/admin/sveltia/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#cms-error')).toBeHidden();
  await expect(page.getByRole('button', { name: /github/i })).toBeVisible({ timeout: 20_000 });
});

test('Sveltia 两个 CDN 都失败时显示可恢复提示', async ({ page }) => {
  await page.route(/https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\/.+sveltia-cms\.js$/, (route) => (
    route.abort('failed')
  ));

  await page.goto('/admin/sveltia/', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#cms-loading')).toBeHidden();
  await expect(page.locator('#cms-error')).toBeVisible();
  await expect(page.locator('#cms-error')).toContainText('原后台仍可从');
  await expect(page.locator('#cms-error a[href="/admin/"]')).toBeVisible();
});
