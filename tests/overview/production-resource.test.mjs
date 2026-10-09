import test from 'node:test';
import assert from 'node:assert/strict';
import { checkUncachedResource } from '../helpers/production-resource.cjs';

const base = 'https://mantou-blog.pages.dev';
const login = 'https://frosty-fire-be92.cloudflareaccess.com/cdn-cgi/access/login/mantou-blog.pages.dev';
const response = (status, headers) => ({ status: () => status, ok: () => status >= 200 && status < 300, headers: () => headers });

test('TM-OVW-010 smoke inspects the protected origin response instead of following its login redirect', async () => {
  for (const path of ['/admin/analytics', '/admin/analytics/', '/admin/analytics/data']) {
    const request = { get: async (_, options) => options?.maxRedirects === 0
      ? response(302, { location: login, 'cache-control': 'private, no-store' })
      : response(200, {}) };
    const observed = await checkUncachedResource(request, path, base);
    assert.equal(observed.status(), 302);
  }
});

test('TM-OVW-010 an anonymous public 200 response cannot satisfy private analytics acceptance', async () => {
  const request = { get: async () => response(200, { 'cache-control': 'no-store' }) };
  await assert.rejects(checkUncachedResource(request, '/admin/analytics/', base), /login challenge/);
});

test('TM-OVW-010 a redirect to an unrelated service cannot satisfy the Access challenge', async () => {
  const request = { get: async () => response(302, { location: 'https://example.org/login', 'cache-control': 'no-store' }) };
  await assert.rejects(checkUncachedResource(request, '/admin/analytics/data', base), /Access team/);
});

test('TM-OVW-007 the original private-path redirect must itself prohibit caching', async () => {
  const request = { get: async () => response(302, { location: login }) };
  await assert.rejects(checkUncachedResource(request, '/admin/analytics/', base), /prohibit caching/);
});

test('TM-OVW-007 public CMS resource checks retain readable status and no-store requirements', async () => {
  await checkUncachedResource({ get: async () => response(200, { 'cache-control': 'no-store' }) }, '/admin/config.yml', base);
  await assert.rejects(checkUncachedResource({ get: async () => response(200, {}) }, '/admin/config.yml', base), /prohibit caching/);
  await assert.rejects(checkUncachedResource({ get: async () => response(403, { 'cache-control': 'no-store' }) }, '/admin/config.yml', base), /readable/);
});
