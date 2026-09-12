const { test, expect } = require('@playwright/test');

test('移动导航按钮满足 WCAG 最低触控尺寸', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const box = await page.locator('#menu-toggle-mobile').boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('内容后台不会被搜索引擎索引', async ({ page }) => {
  await page.goto('/admin/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="robots" i]')).toHaveAttribute('content', /noindex.*nofollow/i);

  await page.goto('/robots.txt');
  await expect(page.locator('body')).toContainText('Disallow: /admin/');
});
