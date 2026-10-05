const { test, expect } = require('@playwright/test');

test.use({ serviceWorkers: 'block' });

function luminance(rgb) {
  return rgb.map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
}

for (const prefix of ['', '/en']) {
  const english = Boolean(prefix);

  test(`订阅说明标题在两主题中清晰可见 ${prefix || '/zh'}`, async ({ page }) => {
    await page.goto(`${prefix}/follow/`);
    const title = page.locator('#follow-promise-title');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => document.body.setAttribute('theme', value), theme);
      await expect(title).toBeVisible();
      const colors = await title.evaluate(element => {
        const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
        return [rgb(getComputedStyle(element).color), rgb(getComputedStyle(element.parentElement).backgroundColor)];
      });
      const [lighter, darker] = colors.map(luminance).sort((a, b) => b - a);
      expect((lighter + 0.05) / (darker + 0.05), `${theme} delivery-card contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test(`文章锚点和反馈跳转后可明确回到文章列表 ${prefix || '/zh'}`, async ({ page }) => {
    await page.goto(`${prefix}/p/20260810/`);
    const tocLink = page.locator('.mantou-reading-toc a').nth(3);
    await tocLink.click();
    const feedback = page.locator('#view-comments');
    await expect(feedback).toHaveAccessibleName(english ? 'Send feedback' : '给我反馈');
    await feedback.click();
    await expect(page.locator('[data-reader-feedback]')).toBeInViewport();
    const back = page.locator('[data-back-to-writing]');
    await expect(back).toHaveText(english ? 'Back to writing' : '返回文章列表');
    await expect(back).toHaveAttribute('href', `${prefix}/posts/`);
    await back.click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/posts/$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${prefix}/p/20260810/(?:#.*)?$`));
    await page.locator('[data-back-to-writing]').click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/posts/$`));
  });

  test(`首页作品保留首发日期并显示真实更新 ${prefix || '/zh'}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${prefix}/`);
    const updates = page.locator('[data-home-work-updates] li');
    await expect(updates.first().locator('h3 a')).toHaveAttribute('href', `${prefix}/works/mantou-checklist-pwa/`);
    const item = updates.filter({ has: page.locator(`a[href="${prefix}/works/mantou-checklist-pwa/"]`) });
    await expect(updates.filter({ has: page.locator(`a[href="${prefix}/works/codex-agents/"]`) }).locator('[data-work-updated]')).toHaveCount(0);
    await expect(item.locator(':scope > time')).toHaveAttribute('datetime', '2026-08-31');
    await expect(item.locator('[data-work-updated] time')).toHaveAttribute('datetime', '2026-10-05');
    await expect(item.locator('[data-work-updated]')).toContainText(english ? 'Updated' : '更新于');
    await item.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`搜索结果含类型和首发日期并保留章节链接 ${prefix || '/zh'}`, async ({ page }) => {
    await page.goto(`${prefix}/search/?q=${encodeURIComponent(english ? 'Pop Mart' : '泡泡玛特')}`);
    const result = page.locator('.pagefind-ui__result').filter({ has: page.locator(`.pagefind-ui__result-link[href="${prefix}/p/20260810/"]`) });
    await expect(result).toBeVisible();
    await expect(result.locator(`[data-pagefind-ui-meta="${english ? 'Published' : '首发日期'}"]`)).toHaveText(`${english ? 'Published' : '首发日期'}: 2026-08-10`);
    await expect(result.locator(`[data-pagefind-ui-meta="${english ? 'Type' : '类型'}"]`)).toHaveText(english ? 'Type: Article' : '类型: 文章');
    if (!english) {
      const excerpts = await result.locator('.pagefind-ui__result-excerpt').allTextContents();
      expect(Math.max(...excerpts.map(value => value.trim().length))).toBeGreaterThanOrEqual(35);
    }
    const subsection = result.locator('.pagefind-ui__result-link[href*="#"]').first();
    await expect(subsection).toBeVisible();
    await subsection.click();
    await expect(page).toHaveURL(new RegExp(`${prefix}/p/20260810/#.+`));
  });
}

test('旧文分类与作品集名称区分且原分类 URL 保持不变', async ({ page }) => {
  await page.goto('/p/20260406/');
  await expect(page.locator('.post-path a[href="/categories/works/"]')).toHaveText('想法与方法');
  await page.locator('.post-path a[href="/categories/works/"]').click();
  await expect(page).toHaveURL(/\/categories\/works\/$/);
  await expect(page.locator('h1')).toContainText('想法与方法');
  await expect(page.locator('#header-desktop a[href="/works/"]')).toHaveText('作品');
});
