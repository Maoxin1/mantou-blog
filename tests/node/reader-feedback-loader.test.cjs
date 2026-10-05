const assert = require('node:assert/strict');
const test = require('node:test');
const { createLoaderHarness, deferred, flush, validComments, validResponse } = require('../helpers/reader-feedback-loader-harness.cjs');

// Run: node --experimental-vm-modules --test tests/node/reader-feedback-loader.test.cjs
// TM-003 / TM-024, scope=mock. No browser, service, database or production network.

async function assertExplicitRecovery(harness) {
  harness.assertRetryable();
  const requestCount = harness.requests.length;
  const importCount = harness.imports.length;
  harness.recover();
  await flush();
  assert.equal(harness.requests.length, requestCount, 'Recovery alone must not retry service requests');
  assert.equal(harness.imports.length, importCount, 'Recovery alone must not reload assets');
  assert.equal(harness.inits.length, 0);
  await harness.click();
  assert.equal(harness.inits.length, 1, 'Explicit retry initializes exactly once after recovery');
  assert.equal(harness.trigger.hidden, true);
  assert.equal(harness.status.textContent, '');
  assert.equal(harness.options.getAttribute('aria-busy'), null);
  assert.equal(harness.helpful.listenerCount('click'), 1);
  assert.equal(harness.editor.focused, true);
  assert.equal(harness.timers.size, 0);
  harness.assertIndependent();
  const successfulRequestCount = harness.requests.length;
  await harness.click();
  assert.equal(harness.inits.length, 1);
  assert.equal(harness.requests.length, successfulRequestCount);
}

test('TM-003 characterization: unconfigured feedback never loads assets or requests a service', async () => {
  const harness = await createLoaderHarness({ configured: false });
  await harness.click();
  assert.equal(harness.imports.length, 0);
  assert.equal(harness.links.length, 0);
  assert.equal(harness.requests.length, 0);
  assert.equal(harness.inits.length, 0);
  harness.assertIndependent();
});

test('TM-003 characterization: repeated opening during resource and API loading or after success initializes once', async () => {
  const harness = await createLoaderHarness();
  assert.equal(harness.imports.length, 0);
  assert.equal(harness.requests.length, 0);
  harness.assertIndependent();
  harness.importGate = deferred();
  harness.fetchGate = deferred();
  const opening = harness.click();
  await flush();
  assert.equal(harness.trigger.disabled, true);
  assert.equal(harness.options.getAttribute('aria-busy'), 'true');
  await Promise.all([harness.click(), harness.click()]);
  assert.equal(harness.imports.length, 1);
  assert.equal(harness.links.length, 1);
  assert.equal(harness.requests.length, 0);
  harness.importGate.resolve();
  await flush();
  assert.equal(harness.requests.length, 2);
  await Promise.all([harness.click(), harness.click()]);
  assert.equal(harness.requests.length, 2);
  harness.assertIndependent();
  harness.fetchGate.resolve();
  await opening;
  await Promise.all([harness.click(), harness.click()]);
  assert.equal(harness.inits.length, 1);
  assert.equal(harness.requests.length, 2);
  assert.equal(harness.helpful.listenerCount('click'), 1);
  assert.equal(harness.timers.size, 0);
  harness.assertIndependent();
});

test('TM-024 positive control: a non-empty valid page still initializes with the configured article and language', async () => {
  const harness = await createLoaderHarness({ english: true });
  harness.response = path => path === '/api/comment' ? {
    errno: 0,
    data: {
      count: 1, page: 1, pageSize: 1, totalPages: 1,
      data: [{
        objectId: 1, time: 1791183600000, comment: '<p>Fixture comment.</p>',
        orig: 'Fixture comment.', like: 0, nick: 'Fixture reader', link: '',
        avatar: '', status: 'approved', sticky: false, children: [],
      }],
    },
  } : validResponse(path);
  await harness.click();
  assert.equal(harness.inits.length, 1);
  assert.equal(harness.inits[0].path, '/p/fixture/');
  assert.equal(harness.inits[0].lang, 'en-US');
  assert.equal(harness.inits[0].serverURL, 'https://comments.example.invalid');
  assert.equal(harness.inits[0].el, '#reader-comments');
  assert.equal(harness.status.textContent, '');
  harness.assertIndependent();
});

test('TM-024 HTTP positive control: native Response 200 with errno 0 initializes once', async () => {
  const harness = await createLoaderHarness();
  await harness.click();
  assert.equal(harness.responses.length, 2);
  for (const { response } of harness.responses) {
    assert.ok(response instanceof Response);
    assert.equal(response.status, 200);
    assert.equal(response.ok, true);
  }
  assert.equal(harness.inits.length, 1);
  assert.equal(harness.trigger.hidden, true);
  assert.equal(harness.status.textContent, '');
  assert.equal(harness.count.textContent, '4');
  assert.equal(harness.options.getAttribute('aria-busy'), null);
  harness.assertIndependent();
});

for (const pathname of ['/api/comment', '/api/article']) {
  test(`TM-024 HTTP regression: native Response 503 with errno 0 from ${pathname} fails and recovers explicitly`, async () => {
    const harness = await createLoaderHarness();
    // Both envelopes stay valid. Only one dependency's HTTP response fails.
    harness.httpStatus = path => path === pathname ? 503 : 200;
    await harness.click();
    assert.equal(harness.responses.length, 2);
    for (const { pathname: path, response } of harness.responses) {
      assert.ok(response instanceof Response);
      assert.equal(response.status, path === pathname ? 503 : 200);
      assert.equal(response.ok, path !== pathname);
    }
    await assertExplicitRecovery(harness);
  });
}

for (const failure of ['CSS', 'JS']) {
  test(`TM-024 characterization: explicit ${failure} failure preserves article/mail and supports explicit recovery`, async () => {
    const harness = await createLoaderHarness();
    harness[failure === 'CSS' ? 'styleFailure' : 'importFailure'] = true;
    await harness.click();
    await flush();
    assert.equal(harness.requests.length, 0);
    if (failure === 'CSS') assert.equal(harness.links[0].removed, true);
    await assertExplicitRecovery(harness);
    assert.equal(harness.links.length, failure === 'CSS' ? 2 : 1);
  });
}

const failures = [
  ['errno 503', harness => { harness.response = () => ({ errno: 503, errmsg: 'Fixture unavailable' }); }],
  ['rejected fetch (DNS/CORS-shaped)', harness => { harness.fetchFailure = new TypeError('Failed to fetch'); }],
  ['invalid JSON', harness => { harness.jsonFailure = new SyntaxError('Unexpected token <'); }],
  ['missing response envelope data', harness => { harness.response = () => ({ errno: 0 }); }],
  ['missing comment data', harness => { harness.response = path => path === '/api/comment' ? { errno: 0, data: { count: 0 } } : validResponse(path); }],
  ['non-array comment data', harness => { harness.response = path => path === '/api/comment' ? { errno: 0, data: { ...validComments(), data: {} } } : validResponse(path); }],
  ['string comment count', harness => { harness.response = path => path === '/api/comment' ? { errno: 0, data: { ...validComments(), count: '0' } } : validResponse(path); }],
  ['invalid counter shape', harness => { harness.response = path => path === '/api/article' ? { errno: 0, data: [] } : validResponse(path); }],
];

for (const english of [false, true]) {
  for (const [name, inject] of failures) {
    test(`TM-024 characterization: ${english ? 'en' : 'zh'} ${name} reports failure and recovers explicitly`, async () => {
      const harness = await createLoaderHarness({ english });
      inject(harness);
      await harness.click();
      await assertExplicitRecovery(harness);
    });
  }
}

const malformedComments = [
  ['negative count', data => ({ ...data, count: -1 })],
  ['fractional count', data => ({ ...data, count: 0.5 })],
  ['missing page', ({ page, ...data }) => data],
  ['missing pageSize', ({ pageSize, ...data }) => data],
  ['missing totalPages', ({ totalPages, ...data }) => data],
  ['invalid page', data => ({ ...data, page: 0 })],
  ['invalid pageSize', data => ({ ...data, pageSize: -1 })],
  ['invalid totalPages', data => ({ ...data, totalPages: -1 })],
];

for (const [name, mutate] of malformedComments) {
  test(`TM-024 schema regression: ${name} must fail before initialization and recover explicitly`, async () => {
    const harness = await createLoaderHarness();
    harness.response = path => path === '/api/comment' ? { errno: 0, data: mutate(validComments()) } : validResponse(path);
    await harness.click();
    await assertExplicitRecovery(harness);
  });
}

function randomFor(seed) {
  let state = seed >>> 0;
  return upper => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) % upper;
  };
}

test('TM-003/TM-024 generated short open/fail/retry sequences preserve independent content and initialize at most once', { timeout: 30000 }, async t => {
  // Generator v1: 100 sequences/seed, <= 4 attempts/sequence and <= 4 repeated
  // opens per pending attempt. A 30-second test budget is not a product SLA.
  const faults = ['CSS', 'JS', 'errno', 'fetch', 'JSON', 'schema'];
  for (const seed of [20261005, 20261006, 20261007]) {
    const started = performance.now();
    const random = randomFor(seed);
    for (let sample = 0; sample < 100; sample++) {
      const harness = await createLoaderHarness({ english: random(2) === 1 });
      const failures = Array.from({ length: random(4) }, () => faults[random(faults.length)]);
      const attempts = [...failures, 'success'].map(outcome => ({ outcome, repeats: random(5) }));
      const trace = [];
      try {
        for (const { outcome, repeats } of attempts) {
          harness.recover();
          const hold = deferred();
          harness.importGate = outcome === 'JS' ? hold : null;
          harness.styleGate = outcome === 'CSS' ? hold : null;
          harness.fetchGate = outcome !== 'CSS' && outcome !== 'JS' ? hold : null;
          if (outcome === 'CSS') {
            // A successfully loaded stylesheet remains cached. CSS failure
            // injection is meaningful only before that success, so the model
            // uses a JS resource failure on subsequent resource attempts.
            if (harness.links.some(link => !link.removed)) {
              harness.styleGate = null;
              harness.importGate = hold;
              harness.importFailure = true;
            } else harness.styleFailure = true;
          }
          if (outcome === 'JS') harness.importFailure = true;
          if (outcome === 'errno') harness.response = () => ({ errno: 503, errmsg: 'Fixture unavailable' });
          if (outcome === 'fetch') harness.fetchFailure = new TypeError('Failed to fetch');
          if (outcome === 'JSON') harness.jsonFailure = new SyntaxError('Invalid fixture JSON');
          if (outcome === 'schema') harness.response = path => path === '/api/comment'
            ? { errno: 0, data: { ...validComments(), count: -1 } } : validResponse(path);
          trace.push({ action: 'open', outcome: harness.importFailure ? 'JS' : outcome, repeats });
          const opening = harness.click();
          await flush();
          const imports = harness.imports.length;
          const requests = harness.requests.length;
          for (let click = 0; click < repeats; click++) await harness.click();
          assert.equal(harness.imports.length, imports, 'Repeated opens cannot duplicate an in-flight import');
          assert.equal(harness.requests.length, requests, 'Repeated opens cannot duplicate in-flight preflight requests');
          assert.equal(harness.inits.length, 0);
          harness.assertIndependent();
          hold.resolve();
          await opening;
          if (outcome !== 'success') {
            harness.assertRetryable();
            const terminalRequests = harness.requests.length;
            const terminalImports = harness.imports.length;
            await flush();
            assert.equal(harness.requests.length, terminalRequests, 'Failure cannot trigger an automatic retry');
            assert.equal(harness.imports.length, terminalImports);
          } else {
            assert.equal(harness.inits.length, 1);
            assert.equal(harness.trigger.hidden, true);
            assert.equal(harness.status.textContent, '');
          }
        }
        const successfulRequests = harness.requests.length;
        const successfulImports = harness.imports.length;
        for (let count = random(5); count > 0; count--) await harness.click();
        assert.equal(harness.inits.length, 1);
        assert.equal(harness.requests.length, successfulRequests);
        assert.equal(harness.imports.length, successfulImports);
        assert.equal(harness.helpful.listenerCount('click'), 1);
        assert.equal(harness.timers.size, 0);
        harness.assertIndependent();
      } catch (error) {
        error.message += `\nGenerator v1 seed=${seed} sample=${sample} replay=${JSON.stringify(trace)}`;
        throw error;
      }
    }
    t.diagnostic(`Generator v1 seed=${seed}; samples=100; maximum attempts=4; maximum repeated opens=4; elapsed_ms=${Math.round(performance.now() - started)}; stopped at sample cap; no counterexample`);
  }
});
