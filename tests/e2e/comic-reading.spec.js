const { test, expect } = require('@playwright/test');

for (const width of [320, 390, 1366]) {
  test(`${width}px 首页首屏展示完整的推荐文章标题`, async ({ page }) => {
    await page.setViewportSize({ width, height: 768 });
    await page.goto('/');
    await expect(page.locator('[data-garden-reading] h3')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

for (const [route, labels] of [['/', ['阅读', '实践', '全部']], ['/en/', ['Reading', 'Practice', 'All']]]) {
  test(`${route} 精选分类可切换并进入真实文章`, async ({ page }) => {
    await page.goto(route);
    const filters = page.locator('[data-home-filters]');
    await filters.getByRole('button', { name: labels[0], exact: true }).click();
    await expect(filters.getByRole('button', { name: labels[0], exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-garden-reading]')).toBeVisible();
    await expect(page.locator('[data-home-featured-post], [data-home-filter="investment"], [data-home-topic="investment"]')).toHaveCount(0);
    await expect(page.locator('[data-home-life]')).toBeHidden();
    await filters.getByRole('button', { name: labels[1], exact: true }).click();
    await expect(page.locator('[data-home-life]')).toBeVisible();
    await expect(page.locator('[data-garden-reading]')).toBeHidden();
    await page.locator('.home-shortcuts a[href="#reading"]').click();
    await expect(filters.getByRole('button', { name: labels[2], exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-home-topic]:visible')).toHaveCount(2);
    await page.locator('[data-garden-reading] h3 a').click();
    await expect(page).toHaveURL(/\/p\/reading-to-artifacts\/$/);
    await expect(page.locator('#content')).toContainText(route === '/' ? '每件作品统一要求的六个模块' : 'Problem');
  });
}

test('无 JavaScript 时所有精选文章仍可阅读', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4174/');
  await expect(page.locator('[data-home-filters]')).toBeHidden();
  await expect(page.locator('[data-home-topic]:visible')).toHaveCount(2);
  await page.locator('[data-garden-reading] h3 a').click();
  await expect(page.locator('#content')).toBeVisible();
  await context.close();
});

test('桌面目录跳转后标题可见，手机保留可展开目录', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/p/reading-to-artifacts/');
  const first = page.locator('.mantou-reading-toc a').first();
  const target = await first.getAttribute('href');
  await first.click();
  await expect(page.locator(target)).toBeInViewport();
  expect((await page.locator(target).boundingBox()).y).toBeGreaterThanOrEqual(100);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/p/reading-to-artifacts/');
  await expect(page.locator('.mantou-reading-toc')).toBeHidden();
  await page.locator('#toc-static summary').click();
  await expect(page.locator('#toc-static a').first()).toBeVisible();
  await expect(page.locator('h1')).toHaveText('把阅读变成作品：我的五本书交付标准');
});

for (const [prefix, cancellation, project] of [['', '已放弃「主动投资系统」项目', '主动投资系统'], ['/en', 'I have abandoned the active investing system project', 'Active investing system']]) {
  test(`${prefix || '/'} 投资系统退出当前方向但历史文章仍可访问`, async ({ page }) => {
    await page.goto(`${prefix}/now/`);
    await expect(page.locator('.section-intro__content')).toContainText(cancellation);
    await expect(page.locator('.now-item')).toHaveCount(2);
    await expect(page.locator('.now-list')).not.toContainText(project);
    const routes = [`${prefix}/p/20260810/`];
    if (!prefix) routes.push('/posts/2026-08-10-别再误解泡泡玛特了！/');
    for (const route of routes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${prefix}/p/20260810/$`));
      await expect(page.locator('#content')).toBeVisible();
    }
  });
}
