const { test, expect } = require('@playwright/test');
const { checkUncachedResource } = require('../helpers/production-resource.cjs');

test('独立网站数据应用版本、安装资源及本人登录边界正确', async ({ request }) => {
  test.setTimeout(150_000);
  const origin = 'https://mantou-blog-data.pages.dev';
  const expected = process.env.SMOKE_EXPECTED_VERSION ? JSON.parse(process.env.SMOKE_EXPECTED_VERSION) :
    await (await request.get('https://mantou-blog.pages.dev/version.json', { headers: { 'cache-control': 'no-cache' } })).json();
  await expect.poll(async () => {
    try {
      const response = await request.get(`${origin}/version.json?smoke=${Date.now()}`, { headers: { 'cache-control': 'no-cache' }, timeout: 10_000 });
      return response.ok() ? await response.json() : { error: response.status() };
    } catch { return { error: 'network' }; }
  }, { timeout: 120_000, intervals: [1000, 2000, 5000, 10000] }).toEqual(expected);
  const version = await request.get(origin + '/version.json');
  expect(version.headers()['cache-control']).toContain('no-store');
  const response = await request.get(origin + '/analytics-app.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.short_name).toBe('网站数据');
  expect(new URL(manifest.start_url, origin).href).toBe(origin + '/admin/analytics/');
  expect(new URL(manifest.scope, origin).href).toBe(origin + '/admin/analytics/');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(value => value.sizes === `${size}x${size}`);
    expect(icon).toBeTruthy();
    const fetched = await request.get(new URL(icon.src, origin).href);
    expect(fetched.ok()).toBe(true);
    const bytes = await fetched.body();
    expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
  await checkUncachedResource(request, origin + '/admin/analytics/', origin);
  await checkUncachedResource(request, origin + '/admin/analytics/data', origin);
});
