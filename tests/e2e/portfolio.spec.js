const { test, expect } = require('@playwright/test');

const routes = [
  '/',
  '/works/',
  '/works/mantou-checklist-pwa/',
  '/about/',
  '/follow/',
  '/search/',
];

async function open(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response.status(), `${path} should load successfully`).toBeLessThan(400);
}

async function publishedWorkRoutes(page) {
  await open(page, '/works/');
  const links = await page.locator('[data-works-index] .work-card__link').evaluateAll((elements) => (
    elements.map((element) => new URL(element.href).pathname)
  ));
  return [...new Set(links)];
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

test('作品集中的每个公开作品都能完成浏览器验收', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${page.url()}: ${message.text()}`);
  });

  const workRoutes = await publishedWorkRoutes(page);
  expect(workRoutes.length, '作品集至少应包含一个公开作品').toBeGreaterThan(0);

  for (const route of workRoutes) {
    for (const viewport of [
      { width: 1366, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await open(page, route);
      await expect(page.locator('[data-work-detail]')).toBeVisible();
      await expect(page.locator('[data-case-map]')).toBeVisible();
      await expect(page.locator('.evidence-panel')).toBeVisible();
      await expect(page.locator('h1')).toHaveCount(1);

      const overflow = await page.evaluate(() => (
        Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
        - document.documentElement.clientWidth
      ));
      expect(overflow, `${route} 不应产生横向溢出`).toBeLessThanOrEqual(1);
    }
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

test('手机导航向键盘与辅助技术暴露真实状态', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/');

  const toggle = page.locator('#menu-toggle-mobile');
  await expect(page.getByRole('button', { name: '打开导航菜单' })).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-controls', 'menu-mobile');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#menu-mobile')).toHaveClass(/active/);

  const firstMenuLink = page.locator('#menu-mobile a').first();
  await firstMenuLink.focus();
  await firstMenuLink.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await expect(page.locator('#menu-mobile')).not.toHaveClass(/active/);
});

test('文章分享地址使用短英文路径且旧中文地址继续跳转', async ({ page }) => {
  await open(page, '/p/20260406/');
  await expect(page.getByRole('heading', { name: '对存储板块的更近一步的思考', level: 1 })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://mantou-blog.pages.dev/p/20260406/',
  );

  const oldPath = '/posts/2026-04-06-%E5%AF%B9%E5%AD%98%E5%82%A8%E6%9D%BF%E5%9D%97%E7%9A%84%E6%9B%B4%E8%BF%91%E4%B8%80%E6%AD%A5%E7%9A%84%E6%80%9D%E8%80%83/';
  await open(page, oldPath);
  await expect(page).toHaveURL(/\/p\/20260406\/$/);
});

test('访客可以从首页一键打开关注入口并继续使用 RSS', async ({ page }) => {
  await open(page, '/');

  await page.getByRole('link', { name: '关注更新' }).click();
  const dialog = page.getByRole('dialog', { name: '关注馒头' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  const emailForm = dialog.locator('[data-follow-form]');
  await expect(emailForm).toBeVisible();
  await expect(emailForm).toHaveAttribute('method', 'post');
  await expect(emailForm).toHaveAttribute('action', /^https:\/\/api\.follow\.it\/subscription-form\//);
  await expect(emailForm.getByRole('textbox', { name: '邮箱地址' })).toHaveAttribute('name', 'email');
  await expect(emailForm.getByRole('button', { name: '关注' })).toBeVisible();
  await expect(dialog.getByRole('link', { name: /用 Inoreader 关注/ })).toHaveAttribute(
    'href',
    /add_feed=.*mantou-blog\.pages\.dev.*index\.xml/,
  );
  await expect(dialog.getByRole('button', { name: /复制 RSS 地址/ })).toHaveAttribute(
    'data-feed-url',
    'https://mantou-blog.pages.dev/index.xml',
  );

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('关注页与文章结尾都提供可发现的关注路径', async ({ page }) => {
  await open(page, '/follow/');
  await expect(page.locator('[data-follow-page]')).toBeVisible();
  await expect(page.getByRole('heading', { name: '邮箱提醒', level: 2 })).toBeVisible();
  await expect(page.locator('[data-follow-page] [data-follow-form]')).toHaveAttribute(
    'action',
    /^https:\/\/api\.follow\.it\/subscription-form\//,
  );
  await expect(page.getByRole('heading', { name: 'RSS 订阅', level: 2 })).toBeVisible();

  await open(page, '/p/20260825/');
  const followCard = page.locator('.follow-card');
  await expect(followCard).toBeVisible();
  await expect(followCard.getByRole('link', { name: /关注馒头/ })).toHaveAttribute('href', '/follow/');
});

test('中文搜索可以找到并打开公开作品', async ({ page }) => {
  await open(page, '/search/');

  const searchbox = page.getByRole('textbox', { name: '搜索文章…' });
  await expect(searchbox).toBeVisible();
  await searchbox.fill('定投清单');

  const result = page.locator('.pagefind-ui__result-link', { hasText: '把个人定投清单做成可离线运行的手机 PWA' });
  await expect(result).toBeVisible({ timeout: 10_000 });
  await expect(result).toHaveAttribute('href', /\/works\/mantou-checklist-pwa\/?$/);
  await result.click();

  await expect(page).toHaveURL(/\/works\/mantou-checklist-pwa\/$/);
  await expect(page.locator('[data-work-detail]')).toBeVisible();
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
