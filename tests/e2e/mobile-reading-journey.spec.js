const { test, expect, devices } = require('@playwright/test');

// Real Chromium mobile/touch emulation, not a resized desktop-only context.
// Screenshots are attached on successful runs too, for human visual review.
test.use({
  ...devices['Pixel 5'],
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  serviceWorkers: 'block',
});

async function evidence(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: 'disabled' });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1);
}

async function targetSize(locator, minimum = 24) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(minimum);
  expect(box.height).toBeGreaterThanOrEqual(minimum);
}

for (const width of [320, 390]) {
  test.describe(`${width}px touch reader journey`, () => {
    test.use({
      viewport: { width, height: 844 },
      screen: { width, height: 844 },
    });

    test('menu closes by touch and navigation survives Back', async ({ page }, testInfo) => {
      await page.goto('/');
      expect(await page.evaluate(() => innerWidth)).toBe(width);
      expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      await noOverflow(page);
      await evidence(page, testInfo, 'home');

      const toggle = page.locator('#menu-toggle-mobile');
      const menu = page.locator('#menu-mobile');
      await targetSize(toggle, 44);
      await toggle.tap();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(menu).toHaveClass(/active/);
      await targetSize(menu.locator('a[href="/posts/"]'));
      await noOverflow(page);
      await evidence(page, testInfo, 'menu-open');
      await toggle.tap();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).not.toHaveClass(/active/);
      await expect(page.locator('body')).not.toHaveClass(/\bblur\b/);

      await toggle.tap();
      await menu.locator('a[href="/posts/"]').tap();
      await expect(page).toHaveURL(/\/posts\/$/);
      await expect(page.locator('[data-posts-archive]')).toBeVisible();
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => new URL(page.url()).pathname).toBe('/');
      // History may restore the open menu. Either state must remain dismissible.
      if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.tap();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).not.toHaveClass(/active/);
      await expect(page.locator('body')).not.toHaveClass(/\bblur\b/);
      await toggle.tap();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await toggle.tap();
      await noOverflow(page);
      await evidence(page, testInfo, 'home-after-back');
    });

    test('search result returns to the retained query', async ({ page }, testInfo) => {
      await page.goto('/');
      await page.locator('#menu-toggle-mobile').tap();
      await page.locator('#menu-mobile a[href="/search/"]').tap();
      await expect(page).toHaveURL(/\/search\/$/);
      const input = page.getByRole('textbox', { name: '搜索文章…' });
      await input.tap();
      await input.fill('泡泡玛特');
      const result = page.locator('.pagefind-ui__result-link[href="/p/20260810/"]').first();
      await expect(result).toBeVisible();
      await noOverflow(page);
      await evidence(page, testInfo, 'search-results');
      await result.tap();
      await expect(page).toHaveURL(/\/p\/20260810\/$/);
      await expect(page.locator('#content')).toBeVisible();
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('泡泡玛特');
      await expect(input).toHaveValue('泡泡玛特');
      await expect(result).toBeVisible();
      await noOverflow(page);
      await evidence(page, testInfo, 'search-after-back');
      await input.fill('');
      await expect(page).toHaveURL(/\/search\/$/);
    });

    test('long article TOC clears the header and archive remains readable', async ({ page }, testInfo) => {
      await page.goto('/p/blog-feedback-system/');
      const toc = page.locator('#toc-static');
      const summary = toc.locator('summary');
      await targetSize(summary, 44);
      if (await toc.evaluate(element => element.open)) await summary.tap();
      await expect(toc).not.toHaveAttribute('open', '');
      await summary.tap();
      const link = toc.locator('a[href^="#"]').first();
      await expect(link).toBeVisible();
      await noOverflow(page);
      await evidence(page, testInfo, 'article-toc');
      const hash = await link.getAttribute('href');
      await link.tap();
      const heading = page.locator(`[id=${JSON.stringify(decodeURIComponent(hash.slice(1)))}]`);
      await expect.poll(async () => {
        const headingBox = await heading.boundingBox();
        const headerBox = await page.locator('#header-mobile').boundingBox();
        return headingBox.y - (headerBox.y + headerBox.height);
      }).toBeGreaterThanOrEqual(8);
      await expect(heading).toBeInViewport();
      await evidence(page, testInfo, 'article-anchor');
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => document.body.setAttribute('theme', value), theme);
        await noOverflow(page);
        await evidence(page, testInfo, `article-${theme}`);
      }

      await page.goto('/posts/');
      const archive = page.locator('[data-posts-archive]');
      await expect(archive.getByRole('heading', { level: 1 })).toBeVisible();
      const first = archive.locator('.archive-item-link').first();
      await targetSize(first);
      await expect(archive.locator('time[datetime]').first()).toBeVisible();
      await noOverflow(page);
      await evidence(page, testInfo, 'archive');
      await testInfo.attach('archive-text-metrics', {
        body: JSON.stringify(await first.evaluate(element => {
          const style = getComputedStyle(element);
          return { fontSize: style.fontSize, lineHeight: style.lineHeight,
            whiteSpace: style.whiteSpace, textOverflow: style.textOverflow };
        }), null, 2),
        contentType: 'application/json',
      });
      const path = await first.getAttribute('href');
      await first.tap();
      await expect.poll(() => new URL(page.url()).pathname).toBe(path);
      await expect(page.locator('#content')).toBeVisible();
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/posts\/$/);
      await noOverflow(page);
    });
  });
}
