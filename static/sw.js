/* mantou の blog —— Service Worker
 * 让博客成为可安装 PWA：桌面/手机可“安装”到主屏，断网时也能看已缓存的文章。
 * 策略：页面导航走“网络优先 + 离线回退”，静态资源走“缓存优先 + 后台更新”。
 * 改动缓存逻辑时，请把 VERSION 加一，旧缓存会被自动清理。
 */
const VERSION = 'v1';
const CACHE = 'mantou-blog-' + VERSION;
const PRECACHE = [
  '/',
  '/offline.html',
  '/site.webmanifest',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 只接管同源请求；外部 CDN / 统计脚本一律放行，避免缓存污染
  if (url.origin !== self.location.origin) return;

  // 页面导航：优先拿最新内容，断网时回退到缓存页，再不行就显示离线页
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('/offline.html')))
    );
    return;
  }

  // 静态资源（CSS/JS/图片/字体）：先用缓存秒开，同时后台静默更新
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
