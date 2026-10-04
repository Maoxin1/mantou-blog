const { test, expect } = require('@playwright/test');

async function expectNoOverflow(page, label) {
  const sizes = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(Math.max(sizes.document, sizes.body), label).toBeLessThanOrEqual(sizes.viewport + 1);
}

test('1440px 顶部导航固定且不遮挡首页，跳转与深色主题可用', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const sidebar = page.locator('#header-desktop');
  await expect(sidebar).toBeVisible();
  await expect(page.locator('#header-mobile')).not.toBeVisible();
  await expect(page.locator('h1')).toHaveText('知不足而奋进，望远山而前行。');
  await expect(sidebar.locator('.mantou-brand img').first()).toHaveAttribute('src', '/images/identity/mantou-wordmark-ink.svg');
  await expect(page.locator('.mantou-hero-picture img')).toHaveAttribute('src', '/images/identity/comic-book-v3-900.webp');
  await expect(page.locator('.mantou-feature-art')).toHaveAttribute('src', '/images/identity/comic-investigation-v3-600.webp');
  await expect(sidebar.locator('.garden-rss')).toHaveAttribute('href', '/index.xml');
  await expect(sidebar.locator('a[href="/now/"]')).toHaveAttribute('href', '/now/');

  const sidebarBox = await sidebar.boundingBox();
  const mainBox = await page.locator('main').boundingBox();
  expect(sidebarBox.x).toBe(0);
  expect(sidebarBox.width).toBe(1440);
  expect(mainBox.y).toBeGreaterThanOrEqual(sidebarBox.y + sidebarBox.height - 1);
  expect(await sidebar.evaluate(element => getComputedStyle(element).position)).toBe('sticky');

  const skip = page.locator('.garden-skip');
  await skip.focus();
  await expect(skip).toBeInViewport();
  await skip.press('Enter');
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator('main')).toHaveAttribute('id', 'main-content');

  for (const marker of ['[data-home-featured-post]', '[data-garden-reading]', '[data-home-featured-work]']) {
    const section = page.locator(marker);
    await section.scrollIntoViewIfNeeded();
    await expect(section.locator('h3')).toBeInViewport();
    await expect(section.locator('.home-action').first()).toBeVisible();
  }
  expect((await sidebar.boundingBox()).y).toBe(0);
  await expect(sidebar).toHaveCSS('opacity', '1');
  await expectNoOverflow(page, 'desktop garden');

  await page.evaluate(() => localStorage.setItem('theme', 'light'));
  await page.reload();
  await sidebar.locator('.theme-switch').click();
  await expect(page.locator('body')).toHaveAttribute('theme', 'dark');
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('theme', 'dark');
  await expectNoOverflow(page, 'dark desktop garden');
});

test('390px 顶部导航滚动后仍可见，菜单可收起并保留搜索和语言入口', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#header-desktop')).not.toBeVisible();
  await expect(page.locator('#header-mobile')).toBeVisible();
  await page.locator('[data-home-featured-work]').scrollIntoViewIfNeeded();
  await expect(page.locator('#header-mobile')).toBeInViewport();
  await expect(page.locator('#header-mobile')).toHaveCSS('opacity', '1');
  const toggle = page.locator('#menu-toggle-mobile');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#menu-mobile')).toHaveClass(/active/);
  await expectNoOverflow(page, 'open mobile garden menu');
  await page.locator('#menu-mobile a[href="/search/"]').click();
  await expect(page).toHaveURL(/\/search\/$/);
  const search = page.getByRole('textbox', { name: '搜索文章…' });
  await expect(search).toBeVisible();
  await search.fill('定投清单');
  await expect(page.locator('.pagefind-ui__result-link').filter({ hasText: '把个人定投清单做成可离线运行的手机 PWA' })).toBeVisible();
  await expectNoOverflow(page, 'mobile garden search results');

  await page.goto('/');
  await page.locator('#header-mobile .language-switch').getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator('h1')).toHaveText('Keep learning.Look ahead.');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expectNoOverflow(page, 'English mobile garden');
  await page.locator('#header-mobile .language-switch').getByRole('link', { name: '中文' }).click();
  await expect(page).toHaveURL(/(?<!en)\/$/);
  await expect(page.locator('h1')).toHaveText('知不足而奋进，望远山而前行。');
});

for (const width of [390, 820, 1024, 1025, 1440]) {
  test(`${width}px 身份文章正文与导航无横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const route of ['/p/20260803/', '/en/p/20260803/']) {
      const response = await page.goto(route);
      expect(response.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('#content')).toBeVisible();
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => document.body.setAttribute('theme', value), theme);
        await expectNoOverflow(page, `${route} at ${width}px in ${theme}`);
      }
      const toc = page.locator('#toc-static');
      if (await toc.count() && width <= 1024) {
        await expect(toc).toHaveAttribute('data-kept', 'true');
        if (!(await toc.evaluate(element => element.open))) await toc.locator('summary').click();
        await expect(toc.locator('#TableOfContents a').first()).toBeVisible();
        await expect(page.locator('#toc-content-auto #TableOfContents')).toHaveCount(0);
      }
      if (width >= 1025) {
        await expect(page.locator('#header-desktop')).toBeVisible();
        await expect(page.locator('#toc-auto')).not.toBeVisible();
        if (await toc.count()) {
          await expect(page.locator('.mantou-reading-toc')).toBeVisible();
          await expect(page.locator('.mantou-reading-toc a').first()).toBeVisible();
          await expect(toc).not.toBeVisible();
        }
        const article = await page.locator('.reading-post').boundingBox();
        const sidebar = await page.locator('#header-desktop').boundingBox();
        expect(article.x).toBeGreaterThanOrEqual(0);
        expect(article.x + article.width).toBeLessThanOrEqual(width);
        expect(article.width).toBeLessThanOrEqual(700);
      }
    }
    expect(errors).toEqual([]);
  });
}


test('旧固定样式缓存不会覆盖新版身份样式', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const stylesheet = page.locator('link[rel="stylesheet"][href^="/css/style.min."]');
  await expect(stylesheet).toHaveAttribute('href', /^\/css\/style\.min\.[a-f0-9]{64}\.css$/);
  await expect(stylesheet).toHaveAttribute('integrity', /^sha256-/);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const cache = await caches.open('mantou-blog-v3');
    await cache.put('/css/style.min.css', new Response('#header-desktop { display: none !important; }', {
      headers: { 'Content-Type': 'text/css' },
    }));
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const oldCachedCSS = await page.evaluate(async () => {
    const cache = await caches.open('mantou-blog-v3');
    return (await cache.match('/css/style.min.css')).text();
  });
  expect(oldCachedCSS).toContain('display: none !important');
  await expect(page.locator('#header-desktop')).toBeVisible();
  expect(await page.locator('#header-desktop').evaluate(element => getComputedStyle(element).position)).toBe('sticky');
  await expectNoOverflow(page, 'garden with a stale previous-release CSS cache');
});
