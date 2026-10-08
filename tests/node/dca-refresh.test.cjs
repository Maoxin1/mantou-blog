const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Run the production refresh and lifecycle wiring without requiring a browser.
const source = fs.readFileSync(path.join(__dirname, '../../assets/js/dca.js'), 'utf8');
const refresh = source.slice(source.indexOf('async function refresh('), source.indexOf('\npopulate();'));
const lifecycle = source.slice(source.indexOf("q('c-refresh').addEventListener('click'"), source.lastIndexOf('\n})();'));
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness({ offline = false, hidden = false, fail = false, deferred = false } = {}) {
  const events = {}, intervals = new Map(), calls = [], pending = [];
  const button = { addEventListener(name, fn) { events[name] = fn; } };
  let timer = 0, now = Date.UTC(2026,9,8,10);
  class Clock extends Date { static now() { return now; } }
  const rows = [{ period: '2026-09' }];
  const respond = value => {
    if (fail) return Promise.reject(new Error('Unavailable'));
    if (deferred) return new Promise(resolve => pending.push(() => resolve(value)));
    return Promise.resolve(value);
  };
  const context = vm.createContext({
    navigator: { onLine: !offline }, DAY: 86400000, Date: Clock, isCurrentPriceHistory: () => true,
    document: { hidden, addEventListener(name, fn) { events[name] = fn; } },
    window: { addEventListener(name, fn) { events[name] = fn; } },
    q: () => button,
    data: { quote: { closeTime: 100 } }, reference: {monthly: rows, weekly: rows},
    prices: { daily: [['2026-10-07', 100]] }, ranges: {},
    request: url => { calls.push(url); return respond(url.includes('klines') ? rows : { closeTime: 101 }); },
    requestPrices: () => { calls.push('prices'); return respond([['2026-10-07', 101]]); },
    parseQuote: raw => ({ time: raw.closeTime, fresh: true }),
    referencePeriods: () => rows, parsePriceHistory: raw => raw,
    remember() {}, populate() {}, history() {}, market() {},
    historyStatus() {}, priceStatus() {}, updateQuoteStatus() {},
    setInterval(fn) { intervals.set(++timer, fn); return timer; },
    clearInterval(id) { intervals.delete(id); },
  });
  vm.runInContext(`let priceState='checking';
${source.match(/let quoteState=.*?;/)[0]}
${refresh}
${lifecycle}
globalThis.state=()=>({priceState,quoteState,busy,historyQueued});`, context);
  return { context, calls, button, intervals, events, pending, advance: ms => now += ms,
    tick: () => [...intervals.values()].forEach(fn => fn()),
    state: () => context.state(),
    histories: () => calls.filter(url => url === 'prices').length,
  };
}

test('initial offline visit labels both USD snapshots and validates once after online recovery', async () => {
  const h = harness({ offline: true });
  assert.equal(h.state().priceState, 'offline');
  assert.equal(h.state().historyQueued, true);
  assert.equal(h.calls.length, 0);
  h.context.navigator.onLine = true; h.events.online(); await settle();
  assert.equal(h.state().priceState, 'fresh');
  assert.equal(h.histories(), 1); assert.equal(h.intervals.size, 1);
  h.tick(); await settle(); assert.equal(h.histories(), 1);
});

test('initial hidden visit completes deferred histories when visible, including online while hidden', async () => {
  const h = harness({ hidden: true, offline: true });
  assert.equal(h.calls.length, 0); assert.equal(h.intervals.size, 0);
  h.context.navigator.onLine = true; h.events.online();
  assert.equal(h.calls.length, 0); assert.equal(h.state().historyQueued, true);
  h.context.document.hidden = false; h.events.visibilitychange(); await settle();
  assert.equal(h.histories(), 1);
  assert.equal(h.state().priceState, 'fresh');
  h.events.visibilitychange(); h.events.pageshow(); await settle();
  assert.equal(h.histories(), 1); assert.equal(h.intervals.size, 1);
  h.events.pagehide(); assert.equal(h.intervals.size, 0);
});

test('ordinary failures finish the initial attempt and do not refetch histories every minute', async () => {
  const h = harness({ fail: true }); await settle();
  assert.equal(h.state().priceState, 'failed');
  assert.equal(h.state().historyQueued, false); assert.equal(h.button.disabled, false);
  h.tick(); await settle(); assert.equal(h.histories(), 1);
  h.events.click(); await settle(); assert.equal(h.histories(), 2);
});

test('repeated recovery events cannot overlap requests or create duplicate polling intervals', async () => {
  const h = harness({ deferred: true });
  for (let i = 0; i < 3; i++) { h.events.online(); h.events.visibilitychange(); h.events.click(); }
  assert.equal(h.calls.length, 2); assert.equal(h.intervals.size, 1);
  assert.equal(h.state().busy, true);
  h.pending.splice(0).forEach(resolve => resolve()); await settle();
  assert.equal(h.calls.length, 4); // Recovery requests coalesce into one subsequent validation.
  h.pending.splice(0).forEach(resolve => resolve()); await settle();
  assert.equal(h.state().busy, false); assert.equal(h.button.disabled, false);
  h.context.document.hidden = true; h.events.visibilitychange(); assert.equal(h.intervals.size, 0);
  h.context.document.hidden = false; h.events.visibilitychange();
  assert.equal(h.histories(), 2); assert.equal(h.intervals.size, 1);
});


test('online recovery during a quote-only request queues exactly one history validation', async () => {
  const h = harness({ deferred: true });
  h.pending.splice(0).forEach(resolve => resolve()); await settle();
  h.tick(); assert.equal(h.histories(), 1);
  h.context.navigator.onLine = false; h.events.offline();
  h.context.navigator.onLine = true; h.events.online(); h.events.online();
  assert.equal(h.histories(), 1);
  h.pending.splice(0).forEach(resolve => resolve()); await settle();
  assert.equal(h.histories(), 2); assert.equal(h.state().busy, true);
  h.pending.splice(0).forEach(resolve => resolve()); await settle();
  assert.equal(h.state().busy, false); assert.equal(h.intervals.size, 1);
});

test('a new UTC day validates history once when visible and when returning from background', async () => {
  const h = harness(); await settle();
  h.advance(86400000); h.tick(); await settle(); assert.equal(h.histories(), 2);
  h.tick(); await settle(); assert.equal(h.histories(), 2);
  h.context.document.hidden = true; h.events.visibilitychange(); h.advance(86400000);
  h.context.document.hidden = false; h.events.visibilitychange(); await settle(); assert.equal(h.histories(), 3);
});

test('failed history has one bounded automatic retry, then needs a new day or an explicit request', async () => {
  const h = harness({ fail: true }); await settle();
  h.advance(600000); h.tick(); await settle(); assert.equal(h.histories(), 2);
  h.advance(600000); h.tick(); await settle(); assert.equal(h.histories(), 2);
  h.events.click(); await settle(); assert.equal(h.histories(), 3);
});
