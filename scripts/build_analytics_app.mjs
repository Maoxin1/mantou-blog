import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
export const APP_ORIGIN = 'https://mantou-blog-data.pages.dev';
export const BLOG_ORIGIN = 'https://mantou-blog.pages.dev';

// Package only the already-built analytics assets and backend. The independent
// app must not publish the blog, its service worker, or private local files.
export function buildAnalyticsApp(source = path.join(root, 'public'), output = path.join(root, 'analytics-public')) {
  source = path.resolve(source); output = path.resolve(output);
  if (source === output || source.startsWith(output + path.sep) || output.startsWith(source + path.sep)) throw new Error('Source and output must be separate directories');
  if (fs.existsSync(output) && fs.readdirSync(output).length) throw new Error('Analytics app output must be empty');
  const files = [
    'admin/analytics/index.html', 'admin/analytics/overview.js', 'admin/analytics/overview.css',
    'analytics-app.webmanifest', 'android-chrome-192x192.png', 'android-chrome-512x512.png', 'apple-touch-icon.png',
    '_routes.json', '_worker.js',
  ];
  for (const file of files) if (!fs.existsSync(path.join(source, file))) throw new Error('Missing verified app input: ' + file);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'analytics-app.webmanifest'), 'utf8'));
  const start = new URL(manifest.start_url, APP_ORIGIN);
  const scope = new URL(manifest.scope, APP_ORIGIN);
  if (start.href !== APP_ORIGIN + '/admin/analytics/' || scope.href !== start.href || manifest.display !== 'standalone') throw new Error('Incorrect analytics installation target');
  for (const file of files) {
    const target = path.join(output, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(source, file), target, { recursive: true });
  }
  fs.writeFileSync(path.join(output, '_redirects'), '/ /admin/analytics/ 302\n');
  fs.writeFileSync(path.join(output, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), geolocation=(), microphone=()\n\n/admin/*\n  Cache-Control: no-store\n\n/version.json\n  Cache-Control: no-store\n');
  return { origin: APP_ORIGIN, sourceSite: 'mantou-blog.pages.dev', startUrl: start.href, output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(JSON.stringify(buildAnalyticsApp()));
}
