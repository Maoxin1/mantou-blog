const { test, expect } = require('@playwright/test');

test('移动导航按钮满足 WCAG 最低触控尺寸', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const box = await page.locator('#menu-toggle-mobile').boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  const lines = await page.locator('#menu-toggle-mobile span').evaluateAll((elements) => (
    elements.map((element) => element.getBoundingClientRect().toJSON())
  ));
  expect(lines).toHaveLength(3);
  expect(lines.every((line) => line.width >= 23)).toBe(true);
  expect(Math.max(...lines.map((line) => line.left)) - Math.min(...lines.map((line) => line.left))).toBeLessThan(1);
  expect(lines[0].top).toBeLessThan(lines[1].top);
  expect(lines[1].top).toBeLessThan(lines[2].top);
});

test('内容后台不会被搜索引擎索引', async ({ page }) => {
  await page.goto('/admin/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="robots" i]')).toHaveAttribute('content', /noindex.*nofollow/i);

  await page.goto('/robots.txt');
  await expect(page.locator('body')).not.toContainText('Disallow: /admin/');
  await expect(page.locator('body')).toContainText('Allow: /');
});

test('未启用的 lightGallery 不会进入生产页面', async ({ page }) => {
  for (const path of ['/', '/p/20260825/']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('script[src*="lightgallery"], link[href*="lightgallery"]')).toHaveCount(0);
  }
});
