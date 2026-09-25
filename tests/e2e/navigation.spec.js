const { test, expect } = require('@playwright/test');

const primaryDestinations = [
  ['文章', '/posts/'],
  ['作品', '/works/'],
  ['近况', '/now/'],
  ['关于', '/about/'],
];

async function open(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response.status(), `${path} should load successfully`).toBeLessThan(400);
}

test('主导航提供文章、作品、近况与关于路径', async ({ page }) => {
  await open(page, '/');

  const navigation = page.locator('#header-desktop nav[aria-label="主要导航"]');
  await expect(navigation).toBeVisible();
  for (const [name, href] of primaryDestinations) {
    const link = navigation.getByRole('link', { name: new RegExp(`^${name}$`) });
    await expect(link).toHaveAttribute('href', href);
  }
});

test('分类总览说明内容归属并提供当前公开状态入口', async ({ page }) => {
  await open(page, '/categories/');

  const overview = page.locator('[data-taxonomy-overview]');
  await expect(overview.getByRole('heading', { name: '内容分类', level: 1 })).toBeVisible();
  for (const path of ['/categories/essays/', '/categories/works/']) {
    await expect(overview.locator(`a[href="${path}"]`)).toBeVisible();
  }
  await overview.locator('a[href="/categories/essays/"]').click();
  await expect(page.locator('.archive-item-link').first()).toBeVisible();
});

test('移动端导航保留语义化主导航与当前页状态', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, '/about/');
  await page.locator('#menu-toggle-mobile').click();

  const navigation = page.locator('#menu-mobile[aria-label="主要导航"]');
  await expect(navigation).toHaveClass(/active/);
  await expect(navigation.getByRole('link', { name: /^关于$/ })).toHaveAttribute('aria-current', 'page');
});
