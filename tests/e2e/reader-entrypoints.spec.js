const { test, expect } = require('@playwright/test');

for (const width of [1366, 390]) {
  test(`首页在 ${width}px 能直达精选和最近更新`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const shortcuts = page.locator('.home-shortcuts');
    await expect(shortcuts).toBeInViewport();
    await shortcuts.locator('a[href="#selected"]').click();
    await expect(page).toHaveURL(/#selected$/);
    await expect(page.locator('#selected h2')).toBeInViewport();
    await shortcuts.locator('a[href="#latest"]').click();
    await expect(page).toHaveURL(/#latest$/);
    await expect(page.locator('#latest h2').first()).toBeInViewport();
    await expect(page.locator('[data-home-featured-post]')).toContainText('精选');
  });
}

test('英文关注页先展示可用的 RSS，中文页先展示邮箱', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/follow/');
  await expect(page.locator('.follow-page__section').first().locator('h2')).toHaveText('RSS subscription');
  await expect(page.locator('#follow-rss-title')).toBeInViewport();
  await expect(page.locator('.follow-page__section').nth(1)).toContainText('Chinese feed only');
  await page.goto('/follow/');
  await expect(page.locator('.follow-page__section').first().locator('h2')).toHaveText('邮箱提醒');
});

test('英文工具入口明确标注中文界面，短图文不显示零分钟', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('[data-home-featured-work] .home-action').first()).toContainText('Open Chinese tool');
  await page.goto('/en/works/');
  await expect(page.locator('.work-card').filter({ hasText: 'offline mobile PWA' }).locator('.work-direct-link')).toContainText('Chinese interface');
  await page.goto('/en/works/mantou-checklist-pwa/');
  await expect(page.locator('.work-detail__actions .portfolio-button--primary')).toContainText('Chinese interface');
  await page.goto('/p/20260825/');
  await expect(page.locator('.post-heading > div.post-meta')).not.toContainText('0 分钟');
  await page.goto('/p/20260803/');
  await expect(page.locator('.post-heading > div.post-meta')).toContainText(/\d+ 分钟/);
});
