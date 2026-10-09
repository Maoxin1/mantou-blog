const { test, expect } = require('@playwright/test');
const fixture = {
  site: 'mantou-blog.pages.dev',
  periods: { current: { from: '2026-10-01T16:00:00Z', to: '2026-10-08T16:00:00Z' },
    previous: { from: '2026-09-24T16:00:00Z', to: '2026-10-01T16:00:00Z' }, timezone: 'Asia/Shanghai' },
  queriedAt: '2026-10-09T00:00:00Z',
  metrics: { pv: { current: 26, previous: 13, absolute: 13, percent: 100, zeroBaseline: false },
    visits: { current: 10, previous: 0, absolute: 10, percent: null, zeroBaseline: true } },
  trend: Array.from({ length: 7 }, (_, i) => ({ date: `2026-10-0${i+2}`, pv: i + 1, visits: 1 })),
  paths: [{ path: '/p/20260803/', pv: 26, visits: 10 }],
  sources: [{ source: '', pv: 26, visits: 10 }],
  filters: { botExclusion: 'excluded-classified-bots', bot: 0, path: null },
  sampling: { current: 1, previous: 1 }, rankLimit: 15,
};
test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
});

test('TM-OVW-005 one-screen overview shows real-format metrics, complete dates and daily trend', async ({ page }) => {
  await page.route('**/admin/analytics/data', route => route.fulfill({ json: fixture }));
  await page.goto('/admin/analytics/');
  await expect(page.getByRole('heading', { name: '网站数据', exact: true })).toBeVisible({ timeout: 4000 });
  await expect(page.locator('#pv')).toHaveText('26');
  await expect(page.locator('#pv-change')).toContainText('100');
  await expect(page.locator('#visits-change')).toContainText('上期为 0');
  await expect(page.locator('#periods')).toContainText('2026-10-02');
  await expect(page.locator('#periods')).toContainText('2026-10-08');
  await expect(page.locator('#trend-table tbody tr')).toHaveCount(7);
  await expect(page.locator('#paths')).toContainText('/p/20260803/');
  await expect(page.locator('#scope')).toContainText('已排除服务商标记的机器人');
  for (const selector of ['#paths li:first-child', '#sources li:first-child']) {
    const box = await page.locator(selector).boundingBox();
    expect(box.y + box.height, `${selector} should be readable in the desktop first screen`).toBeLessThanOrEqual(900);
  }
  await page.evaluate(() => {
    const banner = document.createElement('p');
    banner.textContent = '本地测试示意 · 数字为测试数据，真实接口与线上登录尚未验收';
    banner.style.cssText = 'padding:10px 16px;background:#fff1cd;color:#765416;margin:0;text-align:center;font:14px system-ui';
    document.body.prepend(banner);
  });
  await page.screenshot({ path: '.local-evidence/analytics-overview/overview-preview.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect.poll(async () => {
    const labels = await page.locator('#trend svg text').all();
    const boxes = await Promise.all(labels.map(label => label.boundingBox()));
    return Math.min(...boxes.map(box => box?.height ?? 0));
  }, { message: 'daily chart labels must stay readable after changing to a phone viewport' }).toBeGreaterThanOrEqual(10);
  await page.screenshot({ path: '.local-evidence/analytics-overview/pwa-mobile-preview.png', fullPage: true });
});

test('TM-OVW-006 failure and retry do not present zero or old successful numbers as current', async ({ page }) => {
  let failed = true;
  await page.route('**/admin/analytics/data', route => failed ? route.fulfill({ status: 503, json: { error: { code: 'SETUP_REQUIRED' } } }) : route.fulfill({ json: fixture }));
  await page.goto('/admin/analytics/');
  await expect(page.locator('#status')).toContainText('尚未配置');
  await expect(page.locator('#pv')).toHaveText('—');
  failed = false;
  await page.getByRole('button', { name: '刷新数据', exact: true }).click();
  await expect(page.locator('#pv')).toHaveText('26');
  failed = true;
  await page.getByRole('button', { name: '刷新数据', exact: true }).click();
  await expect(page.locator('#status')).toContainText('尚未配置');
  await expect(page.locator('#pv')).toHaveText('—');
  await expect(page.locator('#paths')).not.toContainText('/p/20260803/');
});

test('TM-OVW-008 untrusted paths and source labels are text, not executable HTML or outside links', async ({ page }) => {
  const data = structuredClone(fixture);
  data.sources = [{ source: '<img src=x onerror="window.injected=true">', pv: 1, visits: 1 }];
  data.paths = [{ path: '//attacker.invalid/', pv: 1, visits: 1 }];
  await page.route('**/admin/analytics/data', route => route.fulfill({ json: data }));
  await page.goto('/admin/analytics/');
  await expect(page.locator('#sources')).toContainText('<img');
  await expect(page.locator('#sources img')).toHaveCount(0);
  await expect(page.locator('#paths a')).toHaveCount(0);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
});

test('TM-OVW-011 Android instructions and browser-parsed manifest target the analytics app', async ({ page, context }) => {
  await page.route('**/admin/analytics/data', route => route.fulfill({ json: fixture }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/analytics/');
  await expect(page.locator('#pv')).toHaveText('26');
  await expect(page.getByRole('link', { name: '手机安装', exact: true })).toHaveAttribute('href', '#install-help');
  await page.getByText('添加到安卓手机桌面', { exact: true }).click();
  await expect(page.locator('#install-help')).toContainText('Chrome');
  await expect(page.locator('#install-help')).toContainText('添加到主屏幕');
  await expect(page.locator('#install-help')).toContainText('查看数据需要联网');
  await expect(page.locator('#install-help')).toContainText('不会授予报表访问权限');
  const session = await context.newCDPSession(page);
  try {
    const parsed = await session.send('Page.getAppManifest');
    expect(parsed.errors.filter(error => error.critical)).toEqual([]);
    const manifest = JSON.parse(parsed.data);
    expect(manifest.start_url).toBe('/admin/analytics/');
    expect(manifest.id).toBe('/admin/analytics/');
    expect(manifest.scope).toBe('/admin/analytics/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.short_name).toBe('网站数据');
    for (const icon of manifest.icons) {
      const response = await page.request.get(icon.src);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  } finally {
    await session.detach();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('TM-OVW-006 offline refresh clears previous metrics and reconnect can recover', async ({ page, context }) => {
  await page.route('**/admin/analytics/data', route => route.fulfill({ json: fixture }));
  await page.goto('/admin/analytics/');
  await expect(page.locator('#pv')).toHaveText('26');
  await page.unroute('**/admin/analytics/data');
  await context.setOffline(true);
  await page.getByRole('button', { name: '刷新数据', exact: true }).click();
  await expect(page.locator('#status')).toHaveAttribute('data-error', 'true');
  await expect(page.locator('#pv')).toHaveText('—');
  await expect(page.locator('#visits')).toHaveText('—');
  await expect(page.locator('#paths li')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#trend svg')).toHaveCount(0);
  await context.setOffline(false);
  await page.route('**/admin/analytics/data', route => route.fulfill({ json: fixture }));
  await page.getByRole('button', { name: '刷新数据', exact: true }).click();
  await expect(page.locator('#pv')).toHaveText('26');
  await expect(page.locator('#status')).not.toHaveAttribute('data-error', 'true');
  await expect(page.locator('#status')).toContainText('数据已显示');
});

test('TM-OVW-009 sampling and bot metadata are explained without claiming unsupported precision', async ({ page }) => {
  const data = structuredClone(fixture);
  data.sampling = { current: 4, previous: 10 };
  await page.route('**/admin/analytics/data', route => route.fulfill({ json: data }));
  await page.goto('/admin/analytics/');
  await expect(page.locator('#pv')).toHaveText('约 26');
  await expect(page.locator('#visits')).toHaveText('约 10');
  await expect(page.locator('#scope')).toContainText('本期、上期包含采样估算');
  await expect(page.locator('#scope')).toContainText('日数相加可能与总量不同');
  await expect(page.locator('#scope')).toContainText('已排除服务商标记的机器人');
  data.filters = { botExclusion: 'unknown', path: null };
  data.sampling = { current: null, previous: null };
  await page.getByRole('button', { name: '刷新数据', exact: true }).click();
  await expect(page.locator('#scope')).toContainText('筛选条件未核对');
  await expect(page.locator('#scope')).toContainText('采样状态未提供');
  await expect(page.locator('#scope')).not.toContainText('已排除服务商标记的机器人');
});
