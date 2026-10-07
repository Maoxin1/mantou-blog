/* mantou の blog —— Service Worker
 * 让博客成为可安装 PWA：桌面/手机可“安装”到主屏，断网时也能看已缓存的文章。
 * 策略：页面导航走“网络优先 + 离线回退”，静态资源走“缓存优先 + 后台更新”。
 * 改动缓存逻辑时，请把 VERSION 加一，旧缓存会被自动清理。
 */
const VERSION = 'v6';
const CACHE_PREFIX = 'mantou-blog-';
const CACHE = CACHE_PREFIX + VERSION;
const NAVIGATION_TIMEOUT_MS = 4000;
const PRECACHE = [
  '/',
  '/offline.html',
  '/en/offline.html',
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
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// 缓存存储可能被禁用或写满；这些错误不应让正常的网络响应变成失败。
async function cachedResponse(request) {
  try {
    const cache = await caches.open(CACHE);
    const response = await cache.match(request);
    return response && response.ok ? response : undefined;
  } catch {
    return undefined;
  }
}

async function cacheSuccessfulResponse(request, response) {
  // Cache.put 不接受 206；错误页、opaque 响应也不能覆盖可离线阅读的正文。
  if (!response || !response.ok || response.status === 206) return;
  try {
    // 必须在异步打开缓存之前克隆，以免正文已经交给浏览器并被消费。
    const copy = response.clone();
    const cache = await caches.open(CACHE);
    await cache.put(request, copy);
  } catch {
    // 配额不足、存储不可用、Vary: * 等情况不影响本次阅读。
  }
}

async function fetchNavigation(request) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      fetch(request, { signal: controller.signal }),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Navigation network timeout'));
          controller.abort();
        }, NAVIGATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function navigationFallback(request, url) {
  const cached = await cachedResponse(request);
  if (cached) return navigationResponse(cached);
  const english = url.pathname === '/en' || url.pathname.startsWith('/en/');
  const offline = await cachedResponse(english ? '/en/offline.html' : '/offline.html');
  if (offline) return navigationResponse(offline);
  // 即使浏览器清空了离线页，respondWith 也始终得到可显示的本地化响应。
  return new Response(english
    ? '<!doctype html><html lang="en"><meta charset="utf-8"><title>Offline</title><h1>You are offline</h1><p>Please try again when you are back online.</p></html>'
    : '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>离线</title><h1>🥯 当前处于离线状态</h1><p>请在恢复网络后重试。</p></html>', {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// Pages redirects /offline.html to /offline. A followed redirect remains
// marked on the cached Response, which cannot satisfy a manual-redirect
// navigation. Replay its successful body without propagating that flag.
function navigationResponse(response) {
  if (!response.redirected) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 只接管同源请求；外部 CDN / 统计脚本一律放行，避免缓存污染
  if (url.origin !== self.location.origin) return;

  // 内容后台依赖最新配置决定“保存草稿”还是“直接发布”。后台必须始终
  // 访问网络，不能被博客离线缓存中的旧 config.yml 改变发布行为。
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return;

  if (req.mode === 'navigate') {
    const network = fetchNavigation(req);
    // 同步登记后台写入，避免响应返回后 Worker 提前终止。
    event.waitUntil(network.then((res) => cacheSuccessfulResponse(req, res)).catch(() => {}));
    event.respondWith(network
      .then((res) => res.status >= 500 ? navigationFallback(req, url) : res)
      .catch(() => navigationFallback(req, url)));
    return;
  }

  // 静态资源（CSS/JS/图片/字体）：先用缓存秒开，同时后台静默更新。
  const network = fetch(req);
  event.waitUntil(network.then((res) => cacheSuccessfulResponse(req, res)).catch(() => {}));
  event.respondWith(cachedResponse(req).then((cached) => cached || network)
    .catch(() => Response.error()));
});
