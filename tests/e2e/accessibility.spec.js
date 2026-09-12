const { test, expect } = require('@playwright/test');

async function open(page, path) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
  expect(response, `${path} should return a response`).not.toBeNull();
  expect(response.status(), `${path} should load successfully`).toBeLessThan(400);
}

function relativeLuminance([red, green, blue]) {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(foreground, background) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)]
    .sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

test('正文链接在浅色和深色主题中都达到常规文字对比度', async ({ page }) => {
  await open(page, '/p/20260118/');
  const link = page.locator('.single .content a').first();
  await expect(link).toBeVisible();

  for (const theme of ['light', 'dark']) {
    await page.evaluate((nextTheme) => {
      document.body.toggleAttribute('theme', nextTheme === 'dark');
    }, theme);

    const colors = await link.evaluate((element) => {
      const parse = (value) => value.match(/\d+/g).slice(0, 3).map(Number);
      return {
        foreground: parse(getComputedStyle(element).color),
        background: parse(getComputedStyle(document.body).backgroundColor),
      };
    });

    expect(
      contrastRatio(colors.foreground, colors.background),
      `${theme} theme body-link contrast should meet WCAG AA`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test('键盘焦点有清晰指示，关注对话框带有完整说明', async ({ page }) => {
  await open(page, '/');
  const trigger = page.locator('[data-follow-open]').first();
  await trigger.focus();
  await expect(trigger).toBeFocused();

  const lightFocus = await trigger.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.outlineColor, style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(lightFocus.style).toBe('solid');
  expect(Number.parseFloat(lightFocus.width)).toBeGreaterThanOrEqual(2);
  expect(lightFocus.color).toBe('rgb(15, 107, 55)');

  await page.evaluate(() => document.body.setAttribute('theme', 'dark'));
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await expect.poll(() => trigger.evaluate((element) => getComputedStyle(element).outlineColor))
    .toBe('rgb(139, 233, 174)');

  await trigger.click();
  const dialog = page.getByRole('dialog', { name: '关注馒头' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-describedby', 'follow-dialog-description');
  await expect(page.locator('#follow-dialog-description')).toHaveText(/选择一种习惯的方式/);
  await expect(dialog.getByRole('textbox', { name: '邮箱地址' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('减少动态效果偏好会降低交互动效', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '/');

  const transition = await page.locator('.portfolio-button').first().evaluate((element) => (
    getComputedStyle(element).transitionDuration
  ));
  expect(Number.parseFloat(transition)).toBeLessThanOrEqual(0.01);
});
