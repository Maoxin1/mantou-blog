const { test, expect } = require('@playwright/test');

for (const width of [1440, 768, 390]) {
  test(`${width}px sticky navigation clears all three home shortcuts and article headings`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const header = page.locator(width > 1024 ? '#header-desktop' : '#header-mobile');
    expect(await page.locator('.page').evaluate(node => getComputedStyle(node).paddingTop)).toBe('0px');
    const top = await page.locator('.page').boundingBox();
    const nav = await header.boundingBox();
    expect(top.y).toBeCloseTo(nav.y + nav.height, 0);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    for (const id of ['latest', 'selected', 'reading']) {
      await page.locator(`.home-shortcuts a[href="#${id}"]`).click();
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect.poll(async () => (await page.locator(`#${id}`).boundingBox()).y,
        { message: `${id} must clear the ${nav.height}px sticky header` }).toBeGreaterThanOrEqual(nav.height + 8);
    }
    await page.goto('/p/blog-feedback-system/');
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    const tocLink = page.locator('#toc-static a').first();
    if (!(await tocLink.isVisible())) await page.locator('#toc-static summary').click();
    await expect(tocLink).toBeVisible();
    const hash = await tocLink.getAttribute('href');
    await tocLink.click();
    const heading = page.locator(`[id=${JSON.stringify(decodeURIComponent(hash.slice(1)))}]`);
    await expect.poll(async () => (await heading.boundingBox()).y).toBeGreaterThanOrEqual(nav.height + 8);
  });
}
