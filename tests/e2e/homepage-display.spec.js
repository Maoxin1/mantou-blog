const { test, expect } = require('@playwright/test');

async function openHome(page) {
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response).not.toBeNull();
  expect(response.status()).toBeLessThan(400);
}

test('首页首屏从具体经历进入作品', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await openHome(page);

  await expect(page.getByRole('heading', { name: /直到身体开始报错/ })).toBeVisible();
  const storyLink = page.getByRole('link', { name: /读这段经历/ });
  await expect(storyLink).toHaveAttribute('href', '/works/body-sculpting/');
  const storyBox = await storyLink.boundingBox();
  expect(storyBox).not.toBeNull();
  expect(storyBox.y).toBeLessThan(900);
  await expect(page.locator('[data-home-featured-work] .editorial-home__work-item')).toHaveCount(2);

  await page.getByRole('link', { name: /浏览全部作品/ }).click();
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
    page.getByRole('link', { name: /读这段经历/ }),
    page.getByRole('link', { name: /浏览全部作品/ }),
    page.getByRole('link', { name: /看完整记录、体重曲线与限制/ }),
  ]) {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  const workLink = page.getByRole('link', { name: /读这段经历/ });
  const destination = await workLink.getAttribute('href');
  await workLink.click();
  await expect(page).toHaveURL(new RegExp(`${destination.replace(/\//g, '\\/')}$`));
});
