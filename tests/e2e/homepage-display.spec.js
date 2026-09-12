const { test, expect } = require('@playwright/test');

async function openHome(page) {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
}

test('首页首屏把身份、公开进度和作品入口连成下一步动作', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openHome(page);

  await expect(page.getByRole('heading', { name: /我是 mantou/ })).toBeVisible();
  const primaryCta = page.getByRole('link', { name: '查看已公开作品' });
  await expect(primaryCta).toHaveAttribute('href', '/works/');
  await expect(page.locator('[data-portfolio-status]')).toContainText(/目前公开 \d+ 个可独立验收的作品/);
  await expect(page.locator('.portfolio-status__count')).toHaveText(/^\d+$/);

  const featuredWork = page.locator('[data-home-featured-work] .work-card__link').first();
  await expect(featuredWork).toBeVisible();
  const featuredBox = await featuredWork.boundingBox();
  expect(featuredBox).not.toBeNull();
  expect(featuredBox.y).toBeLessThan(900 * 1.25);

  await primaryCta.click();
  await expect(page).toHaveURL(/\/works\/$/);
  await expect(page.locator('[data-works-index]')).toBeVisible();
});

test('移动首页没有横向溢出，公开作品入口满足基本触控尺寸', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  const overflow = await page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
      - document.documentElement.clientWidth
  ));
  expect(overflow).toBeLessThanOrEqual(1);

  for (const locator of [
    page.getByRole('link', { name: '查看已公开作品' }),
    page.locator('[data-portfolio-status] a'),
    page.locator('[data-home-featured-work] .work-card__link').first(),
  ]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  const workLink = page.locator('[data-home-featured-work] .work-card__link').first();
  const destination = await workLink.getAttribute('href');
  await workLink.click();
  await expect(page).toHaveURL(new RegExp(`${destination.replace(/\//g, '\\/')}$`));
});
