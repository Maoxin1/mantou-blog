import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

test('TM-OVW-011 home-screen identity launches private analytics without replacing the blog app', () => {
  const html = readFileSync(resolve(root, 'static/admin/analytics/index.html'), 'utf8');
  const link = html.match(/<link\b[^>]*rel="manifest"[^>]*href="([^"]+)"/);
  assert.ok(link, 'the analytics page must advertise its own installable app manifest');
  const base = new URL('https://mantou-blog.pages.dev/admin/analytics/');
  const manifestUrl = new URL(link[1], base);
  assert.equal(manifestUrl.origin, base.origin);
  assert.ok(!manifestUrl.pathname.startsWith('/admin/'), 'non-sensitive install metadata stays outside private Access routes');
  const manifestFile = resolve(root, 'static' + manifestUrl.pathname);
  assert.ok(existsSync(manifestFile), 'advertised manifest must be served');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const start = new URL(manifest.start_url, manifestUrl);
  const scope = new URL(manifest.scope, manifestUrl);
  const id = new URL(manifest.id, start.origin);
  assert.equal(start.href, base.href);
  assert.equal(scope.href, base.href);
  assert.equal(id.origin, base.origin);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.short_name, '网站数据');
  for (const path of ['static/site.webmanifest', 'static/en/site.webmanifest']) {
    const blog = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
    assert.notEqual(id.href, new URL(blog.id ?? blog.start_url, start.origin).href, 'installing analytics must not replace the public blog identity');
  }
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(item => item.sizes === size + 'x' + size);
    assert.ok(icon, 'required install icon missing: ' + size);
    const iconUrl = new URL(icon.src, manifestUrl);
    assert.equal(iconUrl.origin, base.origin);
    const bytes = readFileSync(resolve(root, 'static' + iconUrl.pathname));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
  assert.match(html, /rel="apple-touch-icon"/);
  assert.match(html, /name="theme-color"/);
});
