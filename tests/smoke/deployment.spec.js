const { test, expect, chromium } = require('@playwright/test');
const { withNormalProfile } = require('../helpers/normal-profile');
const { checkUncachedResource } = require('../helpers/production-resource.cjs');

const productionRoutes = [
  { path: '/', marker: '[data-portfolio-home]' },
  { path: '/works/', marker: '[data-works-index]' },
  { path: '/works/mantou-checklist-pwa/', marker: '[data-work-detail]' },
  { path: '/about/', marker: '[data-about-collaboration]' },
  { path: '/search/', marker: '#search' },
  { path: '/en/', marker: '[data-portfolio-home]' },
  { path: '/en/works/', marker: '[data-works-index]' },
  { path: '/en/p/20260803/', marker: '#content' },
];

test('私有统计父路径和接口对未登录请求发起本站 Access 挑战', async ({ request }, testInfo) => {
  for (const resourcePath of ['/admin/analytics', '/admin/analytics/', '/admin/analytics/data']) {
    await checkUncachedResource(request, resourcePath, testInfo.project.use.baseURL);
  }
});

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

test('正式英文搜索和语言切换可以使用', async ({ page }) => {
  await page.goto('/en/search/?q=offline');
  const result = page.locator('.pagefind-ui__result-link').first();
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(result).toHaveAttribute('href', /\/en\//);
  await page.goto('/en/p/20260803/');
  await page.locator('.language-switch:visible').getByRole('link', { name: '中文' }).click();
  await expect(page).toHaveURL('https://mantou-blog.pages.dev/p/20260803/');
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

test('公开案例链接指向的清单工作区仍可进入填写与下载流程', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/works/mantou-checklist-pwa/', { waitUntil: 'domcontentloaded' });
  const artifact = page.locator('.work-detail__actions .portfolio-button--primary');
  await expect(artifact).toHaveAttribute('href', 'https://mantou-checklist.pages.dev/editor');
  const artifactURL = process.env.SMOKE_ARTIFACT_URL || await artifact.getAttribute('href');
  const response = await page.goto(artifactURL, { waitUntil: 'domcontentloaded' });

  expect(response, '清单编辑器应返回响应').not.toBeNull();
  expect(response.status(), '清单编辑器应成功加载').toBeLessThan(400);
  await expect(page).toHaveTitle(/个人定投清单/);
  const formTab = page.getByRole('tab', { name: /填写/ });
  const previewTab = page.getByRole('tab', { name: /预览/ });
  await expect(formTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#checklist-form')).toBeVisible();
  // Config loading and the first render finish after DOMContentLoaded.
  await expect.poll(() => page.locator('#preview-forest').evaluate(image => image.naturalWidth), {
    timeout: 10_000,
  }).toBe(1080);
  const reading = page.getByRole('slider', { name: '破界行动分钟' });
  await reading.press('Home');
  for (let step = 0; step < 18; step += 1) await reading.press('ArrowRight');
  await page.locator('#training-status').selectOption('力量训练');
  await page.locator('#diary-done').check();
  await expect(page.locator('#reading-minutes-value')).toHaveText('90 分钟');
  await expect.poll(() => page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('personal-investment-checklist:v1') || 'null');
    return saved && { readingMinutes: saved.readingMinutes, trainingStatus: saved.trainingStatus, diaryDone: saved.diaryDone };
  })).toEqual({ readingMinutes: 90, trainingStatus: '力量训练', diaryDone: true });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#reading-minutes')).toHaveValue('90');
  await expect(page.locator('#training-status')).toHaveValue('力量训练');
  await expect(page.locator('#diary-done')).toBeChecked();
  await previewTab.click();
  await expect(previewTab).toHaveAttribute('aria-selected', 'true');
  const preview = page.locator('#preview-forest');
  await expect(preview).toBeVisible();
  await expect.poll(() => preview.evaluate(image => ({
    width: image.naturalWidth, height: image.naturalHeight,
  }))).toEqual({ width: 1080, height: 1536 });

  const downloadEvent = page.waitForEvent('download');
  await page.locator('#download-button').click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/^个人定投-.*\.png$/);
  expect(await download.failure()).toBeNull();
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

test('正式 Sveltia 灰度后台可安装且所有后台资源禁止缓存', async ({ request }, testInfo) => {
  test.setTimeout(60_000);
  await withNormalProfile(chromium, testInfo, async (page, context) => {
    const response = await page.goto('/admin/sveltia/', { waitUntil: 'domcontentloaded' });
    expect(response, 'Sveltia 灰度后台应返回响应').not.toBeNull();
    expect(response.status()).toBeLessThan(400);
    await expect(page.locator('#cms-error')).toBeHidden();
    await expect(page.getByRole('button', { name: /github/i })).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveTitle('mantou 内容工作台');
    // The login button can render before Sveltia creates its blob manifest.
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1, { timeout: 20_000 });

    const manifest = await page.evaluate(async () => {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      const manifestResponse = await fetch(manifestLink.href);
      return manifestResponse.json();
    });

    expect(manifest.name).toBe('mantou 内容工作台');
    expect(manifest.short_name).toBe('mantou 内容工作台');
    expect(new URL(manifest.start_url).pathname).toBe('/admin/sveltia/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.map(({ sizes }) => sizes)).toEqual(['192x192', '512x512']);

    const devtools = await context.newCDPSession(page);
    await expect.poll(async () => {
      const { installabilityErrors } = await devtools.send('Page.getInstallabilityErrors');
      return installabilityErrors;
    }, { timeout: 10_000 }).toEqual([]);

    for (const resourcePath of [
      '/admin/',
      '/admin/analytics/',
      '/admin/config.yml?production-cache-check=1',
      '/admin/sveltia/',
      '/admin/sveltia/config.yml?production-cache-check=1',
    ]) {
      await checkUncachedResource(request, resourcePath, testInfo.project.use.baseURL);
    }
  });
});
