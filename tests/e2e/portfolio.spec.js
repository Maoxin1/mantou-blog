const { test, expect } = require('@playwright/test');

const routes = [
  '/',
  '/works/',
  '/works/mantou-checklist-pwa/',
  '/about/',
];

async function open(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response.status(), `${path} should load successfully`).toBeLessThan(400);
}

test('访客能从首页进入作品证据与工作原则', async ({ page }) => {
  await open(page, '/');

  await expect(page.locator('[data-portfolio-home]')).toBeVisible();
  await expect(page.locator('[data-portfolio-status]')).toContainText('首个完整案例已公开');
  await expect(page.locator('[data-proof-strip]')).toHaveCount(0);

  await page.locator('[data-featured-work] .work-card__link').first().click();
  await expect(page).toHaveURL(/\/works\/mantou-checklist-pwa\/$/);
  await expect(page.locator('[data-work-detail]')).toBeVisible();
  await expect(page.locator('[data-case-map]')).toBeVisible();
  await expect(page.locator('[data-verification-matrix]')).toContainText('先失败，修复后通过');

  await open(page, '/about/');
  await expect(page.locator('[data-about-collaboration]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '工作原则', level: 2 })).toBeVisible();
});

test('核心页面没有浏览器运行时错误', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  for (const route of routes) {
    await open(page, route);
  }

  expect(errors).toEqual([]);
});

test('核心页面在桌面、平板和手机宽度下不产生横向溢出', async ({ page }) => {
  const viewports = [
    { name: 'desktop', width: 1366, height: 900 },
    { name: 'tablet', width: 820, height: 1180 },
    { name: 'mobile', width: 390, height: 844 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of routes) {
      await open(page, route);
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      expect(
        Math.max(dimensions.document, dimensions.body),
        `${route} should not overflow at ${viewport.name} width`,
      ).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
  }
});

test('平板宽度下的长标题与说明保持分行且可读', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await open(page, '/');

  const heading = page.locator('.portfolio-section__heading:not(.portfolio-section__heading--inline)').first();
  const titleBlock = heading.locator(':scope > div');
  const description = heading.locator(':scope > p');
  const [titleBox, descriptionBox] = await Promise.all([
    titleBlock.boundingBox(),
    description.boundingBox(),
  ]);

  expect(titleBox).not.toBeNull();
  expect(descriptionBox).not.toBeNull();
  expect(descriptionBox.y).toBeGreaterThanOrEqual(titleBox.y + titleBox.height - 1);

  const lineHeightRatio = await heading.locator('h2').evaluate((element) => {
    const style = getComputedStyle(element);
    return Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
  });
  expect(lineHeightRatio).toBeGreaterThanOrEqual(1.05);
});

test('核心页面保留基础语义与 SEO 信息', async ({ page }) => {
  for (const route of routes) {
    await open(page, route);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-cn');
    await expect(page.locator('main.main')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('meta[name="description" i]')).toHaveAttribute('content', /\S+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/mantou-blog\.pages\.dev\//);
  }
});

test('主题切换会写入本地状态并在刷新后保留', async ({ page }) => {
  await open(page, '/');
  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload({ waitUntil: 'domcontentloaded' });

  const switcher = page.locator('.theme-switch:visible').first();
  await switcher.click();
  await expect(page.locator('body')).toHaveAttribute('theme', 'dark');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveAttribute('theme', 'dark');
});

test('手机导航可以展开并进入作品集', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/');

  await page.locator('#menu-toggle-mobile').click();
  await expect(page.locator('#menu-mobile')).toHaveClass(/active/);
  await page.locator('#menu-mobile a[href="/works/"]').click();
  await expect(page).toHaveURL(/\/works\/$/);
  await expect(page.locator('[data-works-index]')).toBeVisible();
});

test('非生产域名不会加载 Cloudflare 统计脚本', async ({ page }) => {
  const analyticsRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('static.cloudflareinsights.com/beacon.min.js')) {
      analyticsRequests.push(request.url());
    }
  });

  await open(page, '/');
  await expect(page.locator('[data-analytics-loader]')).toHaveCount(1);
  await page.waitForTimeout(250);

  expect(analyticsRequests).toEqual([]);
});
