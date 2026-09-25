const { test, expect } = require('@playwright/test');

async function openHome(page) {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
}

test('首页首屏能进入最近文章，并保留跨类型精选', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openHome(page);

  await expect(page.getByRole('heading', { name: '你好，我是 mantou。' })).toBeVisible();
  const recentLink = page.getByRole('link', { name: /读最近的文章/ });
  await expect(recentLink).toHaveAttribute('href', '#latest');
  const recentBox = await recentLink.boundingBox();
  expect(recentBox).not.toBeNull();
  expect(recentBox.y).toBeLessThan(900);
  await expect(page.locator('[data-home-latest] li')).toHaveCount(5);
  await expect(page.locator('[data-home-selected] article')).toHaveCount(3);
  await expect(page.locator('[data-home-featured-work] img')).toHaveAttribute('src', '/images/mantou-checklist-preview.png');

  await page.getByRole('link', { name: /看做出来的东西/ }).click();
  await expect(page).toHaveURL(/\/works\/$/);
  await expect(page.locator('[data-works-index]')).toBeVisible();
});

test('移动首页没有横向溢出，主要阅读入口满足基本触控尺寸', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openHome(page);

  const overflow = await page.evaluate(() => (
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
      - document.documentElement.clientWidth
  ));
  expect(overflow).toBeLessThanOrEqual(1);

  for (const locator of [
    page.getByRole('link', { name: /读最近的文章/ }),
    page.getByRole('link', { name: /看做出来的东西/ }),
    page.getByRole('link', { name: /进入全部文章/ }),
  ]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole('link', { name: /读最近的文章/ }).click();
  await expect(page).toHaveURL(/#latest$/);
  await expect(page.getByRole('heading', { name: '最近更新' })).toBeInViewport();
});
