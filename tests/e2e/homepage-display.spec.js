const { test, expect } = require('@playwright/test');

for (const width of [1366, 390]) {
  test(`首页在 ${width}px 同时提供文章与作品的实质入口`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /知不足而奋进，\s*望远山而前行。/ })).toBeVisible();
    for (const selector of ['[data-garden-reading]', '[data-home-life]', '[data-home-featured-work]']) {
      const section = page.locator(selector);
      const title = section.locator('h3');
      await section.scrollIntoViewIfNeeded();
      await expect(title).toBeInViewport();
      const action = section.locator('.home-action').first();
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport();
      expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    const sectionOrder = await page.locator('[data-portfolio-home]').evaluate(home => {
      const practice = home.querySelector('[data-home-life]');
      const reading = home.querySelector('[data-garden-reading]');
      const work = home.querySelector('[data-home-featured-work]');
      return Boolean(reading.compareDocumentPosition(practice) & Node.DOCUMENT_POSITION_FOLLOWING)
        && Boolean(practice.compareDocumentPosition(work) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(sectionOrder, '花园先呈现阅读和实践，亲手做的工具随后可达').toBe(true);
    await expect(page.locator('[data-home-latest] li')).toHaveCount(5);
    await expect(page.locator('[data-home-work-updates] li')).toHaveCount(3);
    await expect(page.locator('[data-home-selected] article')).toHaveCount(3);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.locator('[data-home-featured-work]').getByRole('link', { name: /全部作品/ }).click();
    await expect(page).toHaveURL(/\/works\/$/);
  });
}
