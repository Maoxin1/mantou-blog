// Component-unit harness for the exact locally served Waline 3.15.2 handlers.
// The release bundle has no component exports or source map. Extract its submit
// and keyboard handlers unchanged; mock only their closure dependencies. This
// does not exercise Vue rendering, DOM events, a real API, or database writes.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function createSubmissionHarness({ ua = async () => 'test-agent', send, draft = '测试草稿', nick = '测试读者' } = {}) {
  const source = readFileSync(join(__dirname, '../../static/lib/waline/3.15.2/waline.js'), 'utf8');
  assert.equal(source.split('onClick:R').length, 2, 'Extracted submit handler remains wired to the button');
  assert.equal(source.split('onKeydown:se').length, 2, 'Extracted shortcut handler remains wired to the editor');
  const start = ',R=async()=>{';
  const end = ',ce=e=>{';
  assert.equal(source.split(start).length, 2, 'Pinned submit handler must be uniquely identifiable');
  const afterStart = source.slice(source.indexOf(start) + 1);
  assert.equal(afterStart.split(end).length, 2, 'Pinned keyboard-handler boundary must remain unique');
  const handlers = afterStart.slice(0, afterStart.indexOf(end));
  const editor = { value: draft };
  const submitting = { value: false };
  const writes = [];
  const alerts = [];
  const events = [];
  const focus = [];
  const context = {
    i: { value: { serverURL: 'https://comments.example.test', path: '/fixture/', lang: 'zh-CN', login: 'disable', requiredMeta: ['nick'], wordLimit: [1, 1000] } },
    te: editor, a: editor, o: { value: { nick, mail: '', link: '' } }, n: {}, s: { value: {} },
    c: { value: { nick: { focus: () => focus.push('nick') }, mail: { focus: () => focus.push('mail') } } },
    l: { value: { focus: () => focus.push('editor') } },
    F: { value: { nickError: 'Nickname required', mailError: 'Invalid email', anonymous: 'Anonymous', wordHint: '$0–$1; actual $2' } },
    M: { value: true }, A: { value: 4 }, g: { value: { map: {} } }, N: submitting, k: { value: '' },
    Cr: ua, ke: value => value.includes('@'), _r: value => value,
    _: async options => { writes.push(options.comment); return send ? send(options.comment) : { errno: 1, errmsg: '明确拒绝，未保存' }; },
    y: () => { throw new Error('Edit is outside this harness'); },
    r: (...args) => events.push(args), alert: message => alerts.push(message), U: { nextTick: async () => {} },
  };
  const actions = vm.runInNewContext(`(() => { let ${handlers}; return { submit: R, shortcut: se }; })()`, context, { filename: 'waline-3.15.2-submit-handlers.js' });
  return { ...actions, editor, submitting, writes, alerts, events, focus, context };
}

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
module.exports = { createSubmissionHarness, deferred, flush };
