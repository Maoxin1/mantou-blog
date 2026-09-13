const { test, expect } = require('@playwright/test');

const primaryDestinations = [
  ['作品集', '/works/'],
  ['方法与思考', '/categories/works/'],
  ['关于与合作', '/about/'],
  ['日记档案', '/categories/essays/'],
];

async function open(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response.status(), `${path} should load successfully`).toBeLessThan(400);
}

test('主导航清楚区分作品、方法、日记与合作路径', async ({ page }) => {
  await open(page, '/');

  const navigation = page.locator('#header-desktop nav[aria-label="主要导航"]');
  await expect(navigation).toBeVisible();
  for (const [name, href] of primaryDestinations) {
    const link = navigation.getByRole('link', { name: new RegExp(`^${name}：`) });
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('title', /\S+/);
  }
});

test('分类总览说明内容归属并提供当前公开状态入口', async ({ page }) => {
  await open(page, '/categories/');

  const overview = page.locator('[data-taxonomy-overview]');
  await expect(overview.getByRole('heading', { name: '内容分类', level: 1 })).toBeVisible();
  await expect(overview.locator('[data-public-status]')).toContainText('当前公开状态');
  await expect(overview.locator('[data-public-status]')).toContainText(/已公开\s+\d+\s+个可独立验收的作品/);
  await expect(overview.locator('[data-public-status] a')).toHaveAttribute('href', '/works/');
  await expect(overview.locator('[data-content-lane="thinking"]')).toContainText('方法与思考');
  await expect(overview.locator('[data-content-lane="journal"]')).toContainText('日记档案');
});

test('移动端导航保留语义化主导航与当前页状态', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/about/');
  await page.locator('#menu-toggle-mobile').click();

  const navigation = page.locator('#menu-mobile[aria-label="主要导航"]');
  await expect(navigation).toHaveClass(/active/);
  await expect(navigation.getByRole('link', { name: /^关于与合作：/ })).toHaveAttribute('aria-current', 'page');
});
