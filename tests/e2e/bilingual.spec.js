const { test, expect } = require('@playwright/test');

test('语言切换在桌面与手机保留当前文章，中文地址不变', async ({ page }) => {
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/p/20260803/');
    await page.locator('.language-switch:visible').getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/p\/20260803\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toContainText('answers get cheaper');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://mantou-blog.pages.dev/en/p/20260803/');
    await expect(page.locator('link[rel="alternate"][hreflang="zh-cn"]')).toHaveAttribute('href', 'https://mantou-blog.pages.dev/p/20260803/');
    await page.locator('.language-switch:visible').getByRole('link', { name: '中文' }).click();
    await expect(page).toHaveURL(/(?<!en)\/p\/20260803\/$/);
  }
});

test('英文搜索只返回英文内容，订阅使用英文 Feed', async ({ page }) => {
  await page.goto('/en/search/?q=offline');
  const results = page.locator('.pagefind-ui__result-link');
  await expect(results.first()).toBeVisible();
  for (const link of await results.evaluateAll(nodes => nodes.map(n => n.getAttribute('href')))) {
    expect(new URL(link, 'http://localhost').pathname).toMatch(/^\/en\//);
  }
  await page.goto('/en/follow/');
  await expect(page.locator('[data-follow-page] [data-copy-feed]')).toHaveAttribute('data-feed-url', 'https://mantou-blog.pages.dev/en/index.xml');
  await expect(page.locator('[data-follow-page] [data-follow-form]')).toHaveCount(0);
  await expect(page.locator('[data-follow-page]')).toContainText('Chinese feed only');
  await page.goto('/en/p/20260803/');
  await expect(page.locator('.translation-note')).not.toContainText('updated since');
});

test('分页归档切换语言保留页码和 SEO 地址', async ({ page }) => {
  await page.goto('/posts/page/2/');
  await page.locator('.language-switch:visible').getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/posts\/page\/2\/$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://mantou-blog.pages.dev/en/posts/page/2/');
  await expect(page.locator('link[hreflang="zh-cn"]')).toHaveAttribute('href', 'https://mantou-blog.pages.dev/posts/page/2/');
});

test('英文主要页面有正确语言与单一标题，移动布局不溢出', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const path of ['', 'posts/', 'works/', 'works/body-sculpting/', 'about/', 'now/', 'follow/', 'tags/', 'categories/']) {
    const response = await page.goto('/en/' + path);
    expect(response.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    if (path === '') {
      const action = await page.locator('[data-home-featured-work] .home-action').first().boundingBox();
      expect(action.y + action.height).toBeLessThanOrEqual(844);
    }
  }
  expect(errors).toEqual([]);
});

test('归档标题完整显示，作品正文无需越过整张图表', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/posts/');
  const title = page.locator('.archive-item-link').first();
  expect(await title.evaluate(n => getComputedStyle(n).whiteSpace)).toBe('normal');
  await page.goto('/works/body-sculpting/');
  await expect(page.locator('.work-detail__toc')).not.toHaveAttribute('open');
  expect((await page.locator('#content').boundingBox()).y).toBeLessThan(700);
  expect(await page.locator('#content').evaluate(n => parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(16);
  await page.locator('.work-detail__toc summary').click();
  await expect(page.locator('#work-contents a').first()).toBeVisible();
});

test('两种语言的 RSS 都包含全部文章与作品', async ({ request }) => {
  const chinese = await (await request.get('/index.xml')).text();
  const english = await (await request.get('/en/index.xml')).text();
  const chineseItems = chinese.match(/<item>/g) || [];
  const englishItems = english.match(/<item>/g) || [];
  expect(chineseItems.length).toBeGreaterThanOrEqual(209);
  expect(englishItems.length).toBeGreaterThanOrEqual(209);
  expect(englishItems.length).toBeLessThanOrEqual(chineseItems.length);
  expect(english).toContain('<language>en</language>');
  expect(english).toContain('/en/works/mantou-checklist-pwa/');
  expect(english).toContain('Machine translation; not fully reviewed');
});

test('统计入口指向需要登录的 Cloudflare 后台', async ({ page }) => {
  await page.goto('/admin/analytics/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByRole('link', { name: /Open analytics/ })).toHaveAttribute('href', /^https:\/\/dash\.cloudflare\.com\/[^/]+\/web-analytics$/);
  await expect(page.locator('iframe')).toHaveCount(0);
});
