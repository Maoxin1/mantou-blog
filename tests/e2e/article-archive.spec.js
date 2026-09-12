const { test, expect } = require('@playwright/test');

async function open(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response.status(), `${path} should load successfully`).toBeLessThan(400);
}

async function firstArticlePath(page) {
  await open(page, '/posts/');
  const link = page.locator('[data-posts-archive] article.archive-item a.archive-item-link').first();
  await expect(link).toBeVisible();
  return link.evaluate((element) => new URL(element.href).pathname);
}

test('文章页保留可读的上下文、正文索引和阅读路径', async ({ page }) => {
  const path = await firstArticlePath(page);
  await open(page, path);

  const article = page.locator('article.page.single[data-pagefind-body]');
  await expect(article).toBeVisible();
  await expect(article.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(article.locator('nav[aria-label="文章路径"]')).toBeVisible();
  await expect(article.locator('nav[aria-label="文章路径"] a')).toHaveCount(3);
  await expect(article.locator('.content#content')).toBeVisible();
  expect(await article.locator('.post-nav a[rel]').count()).toBeGreaterThan(0);
});

test('文章归档能按年份扫描并进入文章', async ({ page }) => {
  await open(page, '/posts/');

  const archive = page.locator('[data-posts-archive]');
  await expect(archive.getByRole('heading', { level: 1, name: '文章归档' })).toBeVisible();
  await expect(archive.getByRole('region', { name: '按年份浏览文章' })).toBeVisible();
  const firstArticle = archive.locator('article.archive-item').first();
  await expect(firstArticle.locator('time[datetime]')).toBeVisible();
  await expect(firstArticle.locator('a.archive-item-link')).toHaveAttribute('href', /^\/(?:p|posts)\//);
});
