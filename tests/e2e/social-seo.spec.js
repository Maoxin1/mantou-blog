const { test, expect } = require('@playwright/test');

const siteURL = 'https://mantou-blog.pages.dev';
const fallbackImage = `${siteURL}/images/mantou-social.jpg`;

const pages = [
  { path: '/', schema: 'WebSite', title: 'mantou の blog' },
  { path: '/works/', schema: 'CollectionPage', title: '作品集 - mantou の blog' },
  { path: '/works/mantou-checklist-pwa/', schema: 'CreativeWork', title: '把个人定投清单做成可离线运行的手机 PWA - mantou の blog' },
  { path: '/p/20260406/', schema: 'BlogPosting', title: '对存储板块的更近一步的思考 - mantou の blog' },
  { path: '/about/', schema: 'AboutPage', title: '关于与合作 - mantou の blog' },
];

test('核心公开页输出唯一、绝对且可索引的社交与搜索元数据', async ({ page }) => {
  for (const entry of pages) {
    await page.goto(entry.path, { waitUntil: 'domcontentloaded' });
    const canonical = `${siteURL}${entry.path}`;

    await expect(page).toHaveTitle(entry.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
    await expect(page.locator('meta[name="description" i]')).toHaveCount(1);
    await expect(page.locator('meta[name="description" i]')).toHaveAttribute('content', /\S+/);
    await expect(page.locator('meta[name="robots" i]')).not.toHaveAttribute('content', /noindex/i);

    for (const [selector, expected] of [
      ['meta[property="og:type"]', /^(website|article)$/],
      ['meta[property="og:site_name"]', 'mantou の blog'],
      ['meta[property="og:title"]', entry.title],
      ['meta[property="og:description"]', /\S+/],
      ['meta[property="og:url"]', canonical],
      ['meta[property="og:image"]', /^https:\/\//],
      ['meta[name="twitter:card"]', 'summary_large_image'],
      ['meta[name="twitter:title"]', entry.title],
      ['meta[name="twitter:description"]', /\S+/],
      ['meta[name="twitter:image"]', /^https:\/\//],
    ]) {
      await expect(page.locator(selector)).toHaveCount(1);
      await expect(page.locator(selector)).toHaveAttribute('content', expected);
    }

    const schemas = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) => (
      nodes.map((node) => JSON.parse(node.textContent))
    ));
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toMatchObject({
      '@context': 'https://schema.org',
      '@type': entry.schema,
      name: entry.title,
      url: canonical,
    });
    expect(schemas[0].description).toMatch(/\S+/);
    expect(schemas[0].image).toMatch(/^https:\/\//);
    if (entry.schema === 'BlogPosting') {
      expect(schemas[0]).toMatchObject({
        headline: '对存储板块的更近一步的思考',
        author: { '@type': 'Person', name: 'mantou', url: 'https://github.com/Maoxin1' },
      });
      expect(schemas[0].datePublished).toMatch(/^2026-04-06T\d{2}:\d{2}:\d{2}\+08:00$/);
      expect(schemas[0].dateModified).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    }
  }
});

test('未手写摘要的文章输出自身内容摘要，而非站点通用文案', async ({ page }) => {
  await page.goto('/p/20260601/', { waitUntil: 'domcontentloaded' });
  const description = page.locator('meta[name="description" i]');
  await expect(description).not.toHaveAttribute('content', '用真实作品、证据和复盘，把时间转化为能力、资本与自主权。');
  await expect(description).toHaveAttribute('content', /\S{20,}/);
});

test('纯图片文章保留编辑摘要与有意义的替代文本', async ({ page }) => {
  await page.goto('/p/20260825/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('meta[name="description" i]')).toHaveAttribute('content', /以赛亚书 41:10/);
  await expect(page.locator('.single .content img')).toHaveAttribute('alt', /耶稣在人群中/);
});

test('尚无页面特色图时，所有核心页回退到同一稳定站点预览图', async ({ page }) => {
  for (const { path } of pages) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', fallbackImage);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', fallbackImage);
  }

  const image = await page.request.get('/images/mantou-social.jpg');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/jpeg');
});

test('归档分页使用自己的 canonical 和 Open Graph 地址', async ({ page }) => {
  await page.goto('/posts/page/2/', { waitUntil: 'domcontentloaded' });
  const canonical = `${siteURL}/posts/page/2/`;
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
  expect(schema.url).toBe(canonical);
});
