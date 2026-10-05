const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSubmissionHarness, deferred, flush } = require('../helpers/waline-submit-harness.cjs');

test('TM-005 characterization: definite mock rejection retains draft and shows exact response', async () => {
  const h = createSubmissionHarness();
  await h.submit();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].mail, '');
  assert.equal(h.writes[0].url, '/fixture/');
  assert.equal(h.editor.value, '测试草稿');
  assert.deepEqual(h.alerts, ['明确拒绝，未保存']);
  assert.deepEqual(h.events, []);
  assert.equal(h.submitting.value, false);
  await h.submit();
  assert.equal(h.writes.length, 2, 'A new explicit attempt after rejection remains possible');
});

test('TM-019: double click plus Ctrl/Meta+Enter during userAgent preparation sends once', async () => {
  const ua = deferred();
  const response = deferred();
  const h = createSubmissionHarness({ ua: () => ua.promise, send: () => response.promise });
  const first = h.submit();
  const second = h.submit();
  h.shortcut({ key: 'Enter', ctrlKey: true, metaKey: false });
  h.shortcut({ key: 'Enter', ctrlKey: false, metaKey: true });
  assert.equal(h.writes.length, 0);
  ua.resolve('prepared-test-agent');
  await flush();
  assert.equal(h.writes.length, 1, 'Only one POST may start for this in-flight operation');
  h.shortcut({ key: 'Enter', ctrlKey: true, metaKey: false });
  await h.submit();
  assert.equal(h.writes.length, 1, 'Direct and shortcut re-entry must also be blocked during POST');
  response.resolve({ errno: 1, errmsg: '明确拒绝，未保存' });
  await Promise.all([first, second]);
  assert.equal(h.editor.value, '测试草稿');
  assert.equal(h.submitting.value, false);
  await h.submit();
  assert.equal(h.writes.length, 2, 'Rejection ends the operation and allows a new explicit attempt');
});

for (const [label, configure] of [
  ['missing nickname', h => { h.context.o.value.nick = ''; }],
  ['invalid email', h => { h.context.o.value.mail = 'invalid'; }],
  ['empty draft', h => { h.editor.value = ''; }],
  ['invalid word count', h => { h.context.M.value = false; }],
  ['forced login without a token', h => { h.context.i.value.login = 'force'; }],
]) {
  test(`TM-019: ${label} releases the lock without POST`, async () => {
    const h = createSubmissionHarness();
    configure(h);
    const draft = h.editor.value;
    await h.submit();
    assert.equal(h.writes.length, 0);
    assert.equal(h.editor.value, draft);
    assert.equal(h.submitting.value, false);
    h.context.o.value = { nick: '读者', mail: '', link: '' };
    h.editor.value = '下一次明确提交';
    h.context.M.value = true;
    h.context.i.value.login = 'disable';
    await h.submit();
    assert.equal(h.writes.length, 1);
  });
}

test('TM-019: userAgent rejection releases the operation and preserves draft', async () => {
  let unavailable = true;
  const h = createSubmissionHarness({ ua: async () => {
    if (unavailable) throw new Error('UA preparation failed');
    return 'test-agent';
  } });
  await h.submit();
  assert.equal(h.writes.length, 0);
  assert.equal(h.editor.value, '测试草稿');
  assert.deepEqual(h.alerts, ['UA preparation failed']);
  assert.equal(h.submitting.value, false);
  unavailable = false;
  await h.submit();
  assert.equal(h.writes.length, 1);
});

test('TM-019: known mock response holds the lock through completion and then allows next operation', async () => {
  const tick = deferred();
  const h = createSubmissionHarness({ send: async () => ({ errno: 0, data: { objectId: 'mock-only-id', status: 'waiting' } }) });
  h.context.U.nextTick = () => tick.promise;
  const first = h.submit();
  await flush();
  assert.equal(h.writes.length, 1);
  assert.equal(h.submitting.value, true);
  h.editor.value = '下一次草稿';
  await h.submit();
  assert.equal(h.writes.length, 1);
  tick.resolve();
  await first;
  assert.equal(h.submitting.value, false);
  await h.submit();
  assert.equal(h.writes.length, 2);
});

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state; };
}

for (const seed of [20261005, 20261006, 20261007]) {
  test(`TM-019/TM-005 deterministic sequence property: seed=${seed}, cases=100`, { timeout: 30_000 }, async () => {
    const random = seededRandom(seed);
    const alphabet = ['草稿', 'plain', '🙂', 'e\u0301', '\n', '\t', '<x>', '"', '\\', '𝒜'];
    for (let run = 0; run < 100; run++) {
      const sequence = [];
      const ua = deferred();
      const response = deferred();
      const draft = 'case-' + run + ':' + Array.from({ length: 1 + random() % 12 }, () => alphabet[random() % alphabet.length]).join('');
      const h = createSubmissionHarness({ draft, ua: () => ua.promise, send: () => response.promise });
      const started = h.submit();
      const direct = [started];
      const invoke = () => {
        const action = random() % 4;
        sequence.push(['click', 'Ctrl+Enter', 'Meta+Enter', 'Enter'][action]);
        if (action === 0) direct.push(h.submit());
        else h.shortcut({ key: 'Enter', ctrlKey: action === 1, metaKey: action === 2 });
      };
      const context = () => `seed=${seed}, case=${run}, sequence=${JSON.stringify(sequence)}`;
      for (let i = 0, count = 1 + random() % 12; i < count; i++) invoke();
      assert.equal(h.writes.length, 0, context());
      sequence.push('resolve-userAgent');
      ua.resolve('test-agent');
      await flush();
      assert.equal(h.writes.length, 1, context());
      for (let i = 0, count = 1 + random() % 12; i < count; i++) invoke();
      await flush();
      assert.equal(h.writes.length, 1, context());
      sequence.push('definite-rejection');
      response.resolve({ errno: 1, errmsg: '明确拒绝，未保存' });
      await Promise.all(direct);
      assert.equal(h.editor.value, draft, context());
      assert.equal(h.submitting.value, false, context());
      assert.deepEqual(h.events, [], context());
      sequence.push('new-explicit-attempt');
      await h.submit();
      assert.equal(h.writes.length, 2, context());
    }
  });
}

for (const [label, response] of [
  ['missing errmsg', { errno: 1 }],
  ['empty errmsg', { errno: 1002, errmsg: '' }],
]) {
  for (const lang of ['zh-CN', 'en-US']) {
    test(`TM-005 adversarial: ${label}, ${lang}, preserves rejected draft without a success event`, async () => {
      const h = createSubmissionHarness({ send: async () => response });
      h.context.i.value.lang = lang;
      await h.submit();
      assert.equal(h.writes.length, 1);
      assert.equal(h.editor.value, '测试草稿', 'A nonzero error code cannot clear an unconfirmed draft');
      assert.deepEqual(h.events, [], 'Definite mock rejection cannot emit submit success');
      assert.equal(h.alerts.length, 1);
      assert.match(h.alerts[0], lang === 'zh-CN' ? /服务.*错误.*草稿.*保留/ : /service.*error.*draft.*kept/);
      assert.equal(h.submitting.value, false);
      await h.submit();
      assert.equal(h.writes.length, 2, 'An explicit new attempt is still possible');
      assert.equal(h.editor.value, '测试草稿');
    });
  }
}

for (const value of [null, undefined, 'UA preparation unavailable']) {
  for (const lang of ['zh-CN', 'en-US']) {
    test(`TM-019 adversarial UA non-Error rejection: ${String(value)}, ${lang}`, async () => {
      let failing = true;
      const h = createSubmissionHarness({ ua: async () => {
        if (failing) throw value;
        return 'test-agent';
      } });
      h.context.i.value.lang = lang;
      await h.submit();
      assert.equal(h.writes.length, 0, 'Preparation rejection must never reach POST');
      assert.equal(h.editor.value, '测试草稿');
      assert.deepEqual(h.events, []);
      assert.equal(h.submitting.value, false);
      assert.equal(h.alerts.length, 1);
      if (typeof value === 'string') assert.equal(h.alerts[0], value);
      else assert.match(h.alerts[0], lang === 'zh-CN' ? /出现错误.*草稿.*保留/ : /error.*draft.*kept/);
      failing = false;
      await h.submit();
      assert.equal(h.writes.length, 1, 'An explicit attempt after preparation recovery is possible');
    });
  }
}
