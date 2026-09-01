const { test, expect, devices } = require('@playwright/test');

test.use({ ...devices['Pixel 7'] });

for (const admin of [
  { name: 'Decap', path: '/admin/' },
  { name: 'Sveltia', path: '/admin/sveltia/' },
]) {
  test(`${admin.name} 后台在真实移动设备参数下可触控且不横向溢出`, async ({ page }) => {
    const response = await page.goto(admin.path, { waitUntil: 'domcontentloaded' });
    expect(response, `${admin.name} 后台应返回响应`).not.toBeNull();
    expect(response.status()).toBeLessThan(400);

    await expect(page.getByRole('button', { name: /github/i })).toBeVisible({ timeout: 20_000 });

    const environment = await page.evaluate(() => ({
      coarsePointer: window.matchMedia('(pointer: coarse)').matches,
      maxTouchPoints: navigator.maxTouchPoints,
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));

    expect(environment.coarsePointer).toBe(true);
    expect(environment.maxTouchPoints).toBeGreaterThan(0);
    expect(Math.max(environment.document, environment.body)).toBeLessThanOrEqual(
      environment.viewport + 1,
    );
  });
}
