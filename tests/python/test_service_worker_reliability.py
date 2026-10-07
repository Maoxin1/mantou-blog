"""Execute the real service worker with deterministic Cache/Fetch failures.

These checks use Node's built-in VM and Web APIs, without npm dependencies.
Browser acceptance lives in tests/e2e/offline-reliability.spec.js.
"""

import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
NODE = shutil.which("node")
HARNESS = r"""
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const origin = 'https://blog.example';
const handlers = new Map();
const stores = new Map();
const timers = new Map();
const state = {
  writes: [], deleted: [], fetches: [], claimed: false, skipped: false,
  openError: false, matchError: false, putError: false, putGate: null,
  fetch: async () => new Response('online article'),
};
const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).href;
const caches = {
  async open(name) {
    if (state.openError) throw new Error('Storage unavailable');
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      async match(request) {
        if (state.matchError) throw new Error('Cache read failed');
        return store.get(key(request))?.clone();
      },
      async put(request, response) {
        if (state.putGate) await state.putGate;
        if (state.putError) throw new Error('Quota exceeded');
        assert.ok(response.ok, 'Only successful responses may be cached');
        assert.notEqual(response.status, 206);
        state.writes.push(key(request));
        store.set(key(request), response.clone());
      },
      async addAll(paths) { state.precache = paths; },
    };
  },
  async keys() { return [...stores.keys()]; },
  async delete(name) { state.deleted.push(name); return stores.delete(name); },
};
const sandbox = {
  URL, Response, AbortController, Error, caches,
  setTimeout(callback, delay) { const id = {}; timers.set(id, { callback, delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
  fetch(request, options) {
    state.fetches.push({ request, options });
    return state.fetch(request, options);
  },
  self: {
    location: { origin },
    addEventListener(type, handler) { handlers.set(type, handler); },
    skipWaiting: async () => { state.skipped = true; },
    clients: { claim: async () => { state.claimed = true; } },
  },
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('static/sw.js', 'utf8'), sandbox);
const current = vm.runInContext('CACHE', sandbox);
const prefix = 'mantou-blog-';
async function seed(path, body, { name = current, status = 200 } = {}) {
  if (!stores.has(name)) stores.set(name, new Map());
  stores.get(name).set(key(path), new Response(body, { status }));
}
async function cached(path, name = current) {
  return stores.get(name)?.get(key(path))?.clone();
}
function dispatch(path, { mode = 'navigate', method = 'GET' } = {}) {
  let synchronous = true;
  const result = { waits: [], response: undefined };
  const request = { url: key(path), mode, method };
  handlers.get('fetch')({
    request,
    waitUntil(promise) {
      assert.ok(synchronous, 'waitUntil must be registered during dispatch');
      result.waits.push(promise);
    },
    respondWith(promise) { assert.equal(result.response, undefined); result.response = promise; },
  });
  synchronous = false;
  return result;
}
async function settle(event) { await Promise.all(event.waits); }
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
async function tick() { await new Promise((resolve) => setImmediate(resolve)); }
"""


@unittest.skipUnless(NODE, "Node.js is required to execute service-worker regression tests")
class ServiceWorkerReliabilityTests(unittest.TestCase):
    def run_worker(self, scenario: str) -> None:
        result = subprocess.run(
            [NODE, "-e", HARNESS + "\n(async () => {\n" + scenario + "\n})().then(() => console.log('SERVICE_WORKER_TEST_COMPLETE')).catch(error => { console.error(error); process.exitCode = 1; });"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            timeout=15,
        )
        self.assertEqual(0, result.returncode, result.stdout + result.stderr)
        self.assertIn("SERVICE_WORKER_TEST_COMPLETE", result.stdout, "Scenario did not finish; an unresolved promise must not silently pass")

    def test_200_then_503_then_offline_preserves_article(self) -> None:
        self.run_worker(r"""
          const first = dispatch('/article/');
          assert.equal(await (await first.response).text(), 'online article');
          await settle(first);
          state.fetch = async () => new Response('upstream failure', { status: 503 });
          const failed = dispatch('/article/');
          const fallback = await failed.response;
          assert.equal(fallback.status, 200);
          assert.equal(await fallback.text(), 'online article');
          await settle(failed);
          assert.equal(await (await cached('/article/')).text(), 'online article');
          state.fetch = async () => { throw new Error('Offline'); };
          const offline = dispatch('/article/');
          assert.equal(await (await offline.response).text(), 'online article');
          await settle(offline);
          assert.equal(state.writes.length, 1);
          assert.equal(timers.size, 0);
        """)

    def test_uncached_5xx_and_network_errors_use_localized_offline(self) -> None:
        self.run_worker(r"""
          await seed('/offline.html', 'Chinese offline');
          await seed('/en/offline.html', 'English offline');
          for (const status of [500, 502, 503, 504]) {
            state.fetch = async () => new Response('server error', { status });
            for (const [path, expected] of [['/missing/', 'Chinese offline'], ['/en/missing/', 'English offline'], ['/en', 'English offline']]) {
              const event = dispatch(path);
              assert.equal(await (await event.response).text(), expected);
              await settle(event);
              assert.equal(await cached(path), undefined);
            }
          }
          state.fetch = async () => { throw new TypeError('Network failed'); };
          const event = dispatch('/en/missing-again/');
          assert.equal(await (await event.response).text(), 'English offline');
          await settle(event);
        """)

    def test_404_is_returned_without_poisoning_cached_article(self) -> None:
        self.run_worker(r"""
          await seed('/removed/', 'previous article');
          state.fetch = async () => new Response('not found', { status: 404 });
          const event = dispatch('/removed/');
          assert.equal((await event.response).status, 404);
          await settle(event);
          assert.equal(await (await cached('/removed/')).text(), 'previous article');
          assert.equal(state.writes.length, 0);
        """)

    def test_redirected_offline_pages_are_replayed_as_navigation_responses(self) -> None:
        self.run_worker(r"""
          function redirected(response) {
            Object.defineProperty(response, 'redirected', { value: true });
            const clone = response.clone.bind(response);
            response.clone = () => redirected(clone());
            return response;
          }
          if (!stores.has(current)) stores.set(current, new Map());
          for (const [path, body] of [['/offline.html', 'Chinese offline'], ['/en/offline.html', 'English offline']]) {
            stores.get(current).set(key(path), redirected(new Response(body, { headers: { 'Content-Type': 'text/html' } })));
          }
          state.fetch = async () => { throw new TypeError('Offline'); };
          for (const [path, body] of [['/unknown/', 'Chinese offline'], ['/en/unknown/', 'English offline']]) {
            const event = dispatch(path);
            const response = await event.response;
            assert.equal(response.redirected, false, 'Manual navigation cannot receive a followed redirect');
            assert.equal(response.status, 200);
            assert.equal(response.headers.get('Content-Type'), 'text/html');
            assert.equal(await response.text(), body);
            await settle(event);
          }
        """)

    def test_redirected_cached_article_is_replayed_without_losing_body(self) -> None:
        self.run_worker(r"""
          function redirected(response) {
            Object.defineProperty(response, 'redirected', { value: true });
            const clone = response.clone.bind(response);
            response.clone = () => redirected(clone());
            return response;
          }
          if (!stores.has(current)) stores.set(current, new Map());
          stores.get(current).set(key('/article/'), redirected(new Response('article body', { headers: { 'Content-Language': 'en' } })));
          state.fetch = async () => { throw new TypeError('Offline'); };
          const event = dispatch('/article/');
          const response = await event.response;
          assert.equal(response.redirected, false);
          assert.equal(response.headers.get('Content-Language'), 'en');
          assert.equal(await response.text(), 'article body');
          await settle(event);
        """)

    def test_hanging_navigation_times_out_and_aborts(self) -> None:
        self.run_worker(r"""
          await seed('/article/', 'cached article');
          state.fetch = () => new Promise(() => {}); // Even an abort-ignoring fetch cannot block fallback.
          const event = dispatch('/article/');
          assert.equal(timers.size, 1);
          const timer = [...timers.values()][0];
          assert.ok(timer.delay >= 1000 && timer.delay <= 5000, 'Use a bounded, usable navigation timeout');
          timer.callback();
          assert.equal(await (await event.response).text(), 'cached article');
          await settle(event);
          assert.equal(state.fetches[0].options.signal.aborted, true);
          assert.equal(timers.size, 0);
        """)

    def test_late_success_after_timeout_does_not_replace_cached_article(self) -> None:
        self.run_worker(r"""
          await seed('/article/', 'cached article');
          const slow = deferred();
          state.fetch = () => slow.promise;
          const event = dispatch('/article/');
          [...timers.values()][0].callback();
          assert.equal(await (await event.response).text(), 'cached article');
          slow.resolve(new Response('late article'));
          await settle(event);
          await tick();
          assert.equal(await (await cached('/article/')).text(), 'cached article');
        """)

    def test_navigation_write_is_tracked_without_delaying_response(self) -> None:
        self.run_worker(r"""
          const gate = deferred();
          state.putGate = gate.promise;
          const event = dispatch('/article/');
          assert.equal(event.waits.length, 1);
          assert.equal(await (await event.response).text(), 'online article');
          let completed = false;
          settle(event).then(() => { completed = true; });
          await tick();
          assert.equal(completed, false);
          gate.resolve();
          await settle(event);
          assert.equal(await (await cached('/article/')).text(), 'online article');
        """)

    def test_static_cache_hit_refreshes_in_tracked_background(self) -> None:
        self.run_worker(r"""
          await seed('/app.js', 'old asset');
          const refresh = deferred();
          state.fetch = () => refresh.promise;
          const event = dispatch('/app.js', { mode: 'cors' });
          assert.equal(event.waits.length, 1);
          assert.equal(await (await event.response).text(), 'old asset');
          let completed = false;
          settle(event).then(() => { completed = true; });
          await tick();
          assert.equal(completed, false);
          refresh.resolve(new Response('new asset'));
          await settle(event);
          assert.equal(await (await cached('/app.js')).text(), 'new asset');
        """)

    def test_static_503_and_rejected_refresh_do_not_poison_cache(self) -> None:
        self.run_worker(r"""
          await seed('/app.js', 'good asset');
          for (const fail of [async () => new Response('unavailable', { status: 503 }), async () => { throw new Error('offline'); }]) {
            state.fetch = fail;
            const event = dispatch('/app.js', { mode: 'cors' });
            assert.equal(await (await event.response).text(), 'good asset');
            await settle(event);
            assert.equal(await (await cached('/app.js')).text(), 'good asset');
          }
          assert.equal(state.writes.length, 0);
        """)

    def test_uncached_static_failure_returns_valid_error_response(self) -> None:
        self.run_worker(r"""
          state.fetch = async () => { throw new Error('offline'); };
          const event = dispatch('/missing.js', { mode: 'cors' });
          assert.equal((await event.response).type, 'error');
          await settle(event);
        """)

    def test_cache_open_and_write_failures_do_not_break_network_success(self) -> None:
        self.run_worker(r"""
          for (const failure of ['openError', 'putError']) {
            state[failure] = true;
            for (const mode of ['navigate', 'cors']) {
              const event = dispatch('/article/', { mode });
              assert.equal(await (await event.response).text(), 'online article');
              await settle(event);
            }
            state[failure] = false;
          }
        """)

    def test_missing_or_unavailable_cache_has_localized_last_resort(self) -> None:
        self.run_worker(r"""
          state.fetch = async () => { throw new Error('offline'); };
          for (const failure of [null, 'openError', 'matchError']) {
            if (failure) state[failure] = true;
            for (const [path, language, heading] of [['/article/', 'zh-CN', '当前处于离线状态'], ['/en/article/', 'en', 'You are offline']]) {
              const event = dispatch(path);
              const response = await event.response;
              assert.equal(response.status, 503);
              assert.match(response.headers.get('Content-Type'), /text\/html/);
              const body = await response.text();
              assert.ok(body.includes(`lang="${language}"`));
              assert.ok(body.includes(heading));
              await settle(event);
            }
            if (failure) state[failure] = false;
          }
        """)

    def test_partial_and_failed_responses_never_enter_cache(self) -> None:
        self.run_worker(r"""
          for (const response of [new Response('partial', { status: 206 }), new Response('denied', { status: 403 }), Response.error()]) {
            state.fetch = async () => response.clone();
            const event = dispatch('/asset', { mode: 'cors' });
            await event.response;
            await settle(event);
            assert.equal(await cached('/asset'), undefined);
          }
          assert.equal(state.writes.length, 0);
        """)

    def test_activation_deletes_only_old_blog_caches(self) -> None:
        self.run_worker(r"""
          const old = prefix + 'v0';
          for (const name of [old, current, 'other-app-v1', 'mantou-checklist-v1']) stores.set(name, new Map());
          const waits = [];
          handlers.get('activate')({ waitUntil: (promise) => waits.push(promise) });
          await Promise.all(waits);
          assert.deepEqual(state.deleted, [old]);
          assert.ok(stores.has(current));
          assert.ok(stores.has('other-app-v1'));
          assert.ok(stores.has('mantou-checklist-v1'));
          assert.equal(state.claimed, true);
        """)

    def test_fallback_does_not_read_other_app_caches_or_bad_cached_responses(self) -> None:
        self.run_worker(r"""
          await seed('/article/', 'wrong app', { name: 'other-app-v1' });
          await seed('/article/', 'legacy cached error', { status: 503 });
          await seed('/offline.html', 'local offline');
          state.fetch = async () => { throw new Error('offline'); };
          const event = dispatch('/article/');
          assert.equal(await (await event.response).text(), 'local offline');
          await settle(event);
        """)

    def test_admin_non_get_and_cross_origin_requests_are_not_intercepted(self) -> None:
        self.run_worker(r"""
          for (const path of ['/admin', '/admin/', '/admin/config.yml?version=1', '/admin/sveltia/', '/admin/analytics/', 'https://cdn.example/app.js']) {
            for (const mode of ['navigate', 'cors']) {
              const event = dispatch(path, { mode });
              assert.equal(event.response, undefined);
              assert.equal(event.waits.length, 0);
            }
          }
          const post = dispatch('/article/', { method: 'POST' });
          assert.equal(post.response, undefined);
          assert.equal(state.fetches.length, 0);
        """)

    def test_install_keeps_bilingual_offline_and_pwa_precache(self) -> None:
        self.run_worker(r"""
          const waits = [];
          handlers.get('install')({ waitUntil: (promise) => waits.push(promise) });
          await Promise.all(waits);
          for (const path of ['/', '/offline.html', '/en/offline.html', '/site.webmanifest', '/favicon.ico']) assert.ok(state.precache.includes(path));
          assert.equal(state.skipped, true);
        """)


if __name__ == "__main__":
    unittest.main()
