import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildAnalyticsApp, APP_ORIGIN, BLOG_ORIGIN } from '../../scripts/build_analytics_app.mjs';

const root = path.resolve(process.env.PWA_SOURCE_ROOT || path.join(import.meta.dirname, '../..'));
test('BUG-OVW-QA-005 installation entry does not sit inside the already-installed blog origin', () => {
  const html = fs.readFileSync(path.join(root, 'static/admin/analytics/index.html'), 'utf8');
  const entry = html.match(/<a\b[^>]*id="app-entry"[^>]*href="([^"]+)"/);
  assert.ok(entry, 'an explicit independent-app installation entry is required');
  const url = new URL(entry[1]);
  assert.notEqual(url.origin, BLOG_ORIGIN, 'the root blog app must not enclose the analytics installation origin');
  assert.equal(url.origin, APP_ORIGIN);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'static/analytics-app.webmanifest'), 'utf8'));
  assert.equal(new URL(manifest.start_url, url).href, url.href, 'the independent app icon must start on the overview');
  assert.equal(manifest.display, 'standalone');
  assert.match(html, /href="https:\/\/mantou-blog\.pages\.dev\/admin\/"/);
  assert.match(html, /href="https:\/\/mantou-blog\.pages\.dev\/"/);
});

function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-app-test-'));
  t.after(() => {
    assert.equal(path.dirname(path.resolve(temporary)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temporary).startsWith('analytics-app-test-'));
    fs.rmSync(temporary, { recursive: true, force: true });
  });
  const source = path.join(temporary, 'source'), output = path.join(temporary, 'app');
  fs.mkdirSync(path.join(source, 'admin/analytics'), { recursive: true });
  fs.mkdirSync(path.join(source, '_worker.js'));
  fs.writeFileSync(path.join(source, '_worker.js/index.js'), 'export default {};');
  for (const file of ['admin/analytics/index.html', 'admin/analytics/overview.js', 'admin/analytics/overview.css', 'android-chrome-192x192.png', 'android-chrome-512x512.png', 'apple-touch-icon.png', '_routes.json']) fs.writeFileSync(path.join(source, file), 'fixture');
  const manifest = { start_url: '/admin/analytics/', scope: '/admin/analytics/', display: 'standalone' };
  fs.writeFileSync(path.join(source, 'analytics-app.webmanifest'), JSON.stringify(manifest));
  for (const file of ['sw.js', 'site.webmanifest', 'index.html', '.dev.vars', 'admin/config.yml']) fs.writeFileSync(path.join(source, file), 'do-not-publish');
  return { source, output, manifest };
}

test('independent artifact exposes installation metadata and guarded backend, excluding blog and private local files', t => {
  const { source, output } = fixture(t);
  buildAnalyticsApp(source, output);
  for (const file of ['admin/analytics/index.html', '_worker.js/index.js', 'analytics-app.webmanifest', '_routes.json']) assert.ok(fs.existsSync(path.join(output, file)));
  for (const file of ['sw.js', 'site.webmanifest', 'index.html', '.dev.vars', 'admin/config.yml']) assert.ok(!fs.existsSync(path.join(output, file)), 'unexpected public asset: ' + file);
  assert.match(fs.readFileSync(path.join(output, '_redirects'), 'utf8'), /^\/ \/admin\/analytics\/ 302\n$/);
  assert.match(fs.readFileSync(path.join(output, '_headers'), 'utf8'), /\/admin\/\*\n  Cache-Control: no-store/);
});

test('invalid installation start URL and stale nonempty output fail before packaging', t => {
  const { source, output, manifest } = fixture(t);
  fs.writeFileSync(path.join(source, 'analytics-app.webmanifest'), JSON.stringify({ ...manifest, start_url: '/' }));
  assert.throws(() => buildAnalyticsApp(source, output), /Incorrect analytics installation target/);
  assert.ok(!fs.existsSync(output));
  fs.mkdirSync(output); fs.writeFileSync(path.join(output, '.dev.vars'), 'stale');
  assert.throws(() => buildAnalyticsApp(source, output), /must be empty/);
});
