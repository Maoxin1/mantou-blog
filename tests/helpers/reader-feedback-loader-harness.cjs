const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const root = join(__dirname, '../..');
const loaderSource = readFileSync(join(root, 'static/js/reader-feedback.js'), 'utf8');
const vendorSource = readFileSync(join(root, 'static/lib/waline/3.15.2/waline.js'), 'utf8');
const clientURL = `/lib/waline/3.15.2/waline.${createHash('sha256').update(vendorSource).digest('hex')}.js`;

function element(extra = {}) {
  const listeners = new Map();
  const attributes = new Map();
  return {
    hidden: false,
    disabled: false,
    textContent: '',
    style: {},
    ...extra,
    addEventListener(type, listener) {
      const entries = listeners.get(type) || [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    async dispatch(type) {
      // Deliberately dispatch even on hidden/disabled controls to test the
      // production busy/instance guards independently of browser defaults.
      await Promise.all((listeners.get(type) || []).map(listener => listener()));
    },
    listenerCount(type) { return (listeners.get(type) || []).length; },
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
  };
}

const validComments = () => ({ count: 0, data: [], page: 1, pageSize: 1, totalPages: 0 });
const validResponse = pathname => ({
  errno: 0,
  data: pathname === '/api/comment' ? validComments() : [{ reaction0: 4 }],
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// This is a component/mock harness, not browser E2E. It executes the unchanged
// production loader and complete local Waline module with native VM modules.
// Real Waline API exports parse native Node Response objects from mocked fetch;
// only Vue init is a spy. HTTP status and JSON parsing use Response semantics.
// DOM layout, browser module caching, CORS/TLS and real service persistence are
// intentionally not simulated. No source rewriting or network access occurs.
async function createLoaderHarness({ english = false, configured = true } = {}) {
  assert.equal(typeof vm.SourceTextModule, 'function', 'Run with --experimental-vm-modules');
  const trigger = element({ textContent: english ? 'Open comments' : '打开评论' });
  const status = element();
  const helpful = element({ hidden: true });
  const helpfulLabel = element();
  const count = element();
  const editor = element({ focused: false, focus() { this.focused = true; } });
  const article = Object.freeze({ hidden: false, textContent: 'Fixture article remains readable.' });
  const mail = Object.freeze({ hidden: false, href: 'mailto:reader@example.invalid' });
  const elements = new Map([
    ['[data-feedback-load]', trigger], ['[data-feedback-status]', status],
    ['[data-feedback-helpful]', helpful], ['[data-feedback-helpful-label]', helpfulLabel],
    ['[data-feedback-count]', count], ['textarea', editor],
  ]);
  const options = element({
    dataset: { feedbackServer: 'https://comments.example.invalid', feedbackPath: '/p/fixture/', feedbackLang: english ? 'en' : 'zh-cn', feedbackClient: clientURL },
    querySelector: selector => elements.get(selector) ?? null,
  });
  const state = {
    trigger, status, helpful, helpfulLabel, count, editor, article, mail, options,
    imports: [], links: [], requests: [], responses: [], inits: [], timers: new Map(),
    importFailure: false,
    cacheFailedImports: false,
    failedImports: new Set(),
    styleFailure: false,
    importGate: null,
    styleGate: null,
    fetchGate: null,
    response: pathname => validResponse(pathname),
    httpStatus: () => 200,
    fetchFailure: null,
    jsonFailure: null,
  };
  let timerId = 0;
  const document = {
    querySelector(selector) {
      if (selector === '[data-feedback-server]') return configured ? options : null;
      if (selector === 'article') return article;
      if (selector === '.reader-feedback__email') return mail;
      throw new Error(`Unmodelled DOM selector: ${selector}`);
    },
    createElement: tag => element({ tagName: tag, remove() { this.removed = true; } }),
    head: {
      append(link) {
        state.links.push(link);
        const failed = state.styleFailure;
        const gate = state.styleGate;
        queueMicrotask(async () => {
          if (gate) await gate.promise;
          if (failed) link.onerror();
          else link.onload();
        });
      },
    },
  };
  const context = vm.createContext({
    document, window: {}, navigator: { language: 'en-US' }, console, URL, AbortController,
    localStorage: { getItem: () => null, setItem() {} },
    setTimeout(callback, milliseconds) {
      const id = ++timerId;
      state.timers.set(id, { callback, milliseconds });
      return id;
    },
    clearTimeout: id => state.timers.delete(id),
    async fetch(url, request = {}) {
      const parsed = new URL(url);
      assert.equal(parsed.origin, 'https://comments.example.invalid', 'Only the reserved fixture service is allowed');
      assert.equal(request.method ?? 'GET', 'GET', 'Loader must not send comments or reactions');
      state.requests.push({ url, pathname: parsed.pathname, request });
      const failure = state.fetchFailure;
      const jsonFailure = state.jsonFailure;
      const response = state.response;
      const httpStatus = state.httpStatus;
      const gate = state.fetchGate;
      if (gate) await gate.promise;
      if (failure) throw failure;
      // Invalid JSON is a real parse failure; valid fixture values cross the
      // same JSON boundary as a fetch response rather than remaining objects.
      const result = new Response(jsonFailure ? '<invalid fixture JSON>' : JSON.stringify(response(parsed.pathname)), {
        status: httpStatus(parsed.pathname),
        headers: { 'Content-Type': 'application/json' },
      });
      state.responses.push({ pathname: parsed.pathname, response: result });
      return result;
    },
  });
  const vendor = new vm.SourceTextModule(vendorSource, { context, identifier: 'waline-3.15.2.js' });
  await vendor.link(() => { throw new Error('Unexpected dependency in vendored bundle'); });
  await vendor.evaluate();
  const names = ['init', 'getComment', 'getArticleCounter', 'updateArticleCounter'];
  const api = new vm.SyntheticModule(names, function () {
    for (const name of names) this.setExport(name, name === 'init' ? config => {
      state.inits.push(config);
      return { destroy() {} };
    } : vendor.namespace[name]);
  }, { context });
  await api.link(() => { throw new Error('Unexpected synthetic dependency'); });
  await api.evaluate();
  const loader = new vm.SourceTextModule(loaderSource, {
    context,
    identifier: 'reader-feedback.js',
    async importModuleDynamically(specifier) {
      const base = new URL(options.dataset.feedbackClient, 'https://blog.example.invalid');
      const requested = new URL(specifier, base);
      assert.equal(requested.origin, base.origin);
      assert.equal(requested.pathname, base.pathname);
      assert.match(requested.search, /^(?:\?retry=[1-9]\d*)?$/);
      assert.equal(requested.hash, '');
      state.imports.push(specifier);
      const failed = state.importFailure;
      const gate = state.importGate;
      if (gate) await gate.promise;
      if (state.cacheFailedImports && state.failedImports.has(specifier)) {
        throw new TypeError('Previously failed module URL remains in the module map');
      }
      if (failed) {
        if (state.cacheFailedImports) state.failedImports.add(specifier);
        throw new TypeError('Fixture module loading failed');
      }
      return api;
    },
  });
  await loader.link(() => { throw new Error('Unexpected static loader import'); });
  await loader.evaluate();
  state.click = () => trigger.dispatch('click');
  state.assertIndependent = () => {
    assert.equal(article.hidden, false);
    assert.equal(article.textContent, 'Fixture article remains readable.');
    assert.equal(mail.hidden, false);
    assert.equal(mail.href, 'mailto:reader@example.invalid');
  };
  state.assertRetryable = () => {
    assert.equal(state.inits.length, 0, 'Invalid/unavailable comments must not initialize Waline');
    assert.equal(trigger.disabled, false, 'Explicit retry stays enabled');
    assert.equal(trigger.hidden, false);
    assert.equal(helpful.hidden, true);
    assert.match(status.textContent, english ? /could not load.*private email/ : /评论暂时没加载出来.*邮件/);
    assert.equal(trigger.textContent, english ? 'Try again' : '再试一次');
    assert.equal(options.getAttribute('aria-busy'), null);
    state.assertIndependent();
  };
  state.recover = () => {
    state.importFailure = false;
    state.styleFailure = false;
    state.fetchFailure = null;
    state.jsonFailure = null;
    state.response = pathname => validResponse(pathname);
    state.httpStatus = () => 200;
  };
  return state;
}

const flush = () => new Promise(resolve => setImmediate(resolve));

module.exports = { createLoaderHarness, deferred, flush, validComments, validResponse };
