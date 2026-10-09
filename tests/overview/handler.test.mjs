import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverviewHandler } from '../../functions/_lib/handler.mjs';
import { OverviewError } from '../../functions/_lib/errors.mjs';
const request = new Request('https://mantou-blog.pages.dev/admin/analytics/data');

test('TM-OVW-007 authorization runs before data access or cache; private response is no-store', async () => {
  let reads = 0;
  const handle = createOverviewHandler({ authorizeFn: async () => { throw new OverviewError('UNAUTHORIZED', 401); },
    readFn: async () => { reads++; return {}; } });
  const response = await handle({ request, env: {} });
  assert.equal(response.status, 401);
  assert.equal(reads, 0);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.deepEqual(await response.json(), { error: { code: 'UNAUTHORIZED' } });
});

test('TM-OVW-006 repeated authorized reads share in-flight result; failure has no success/zero body', async () => {
  let reads = 0;
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const handle = createOverviewHandler({ authorizeFn: async () => ({ email: 'owner@example.invalid' }),
    clock: () => Date.parse('2026-10-09T00:00:00Z'), readFn: async () => { reads++; await pending; return { site: 'mantou-blog.pages.dev' }; } });
  const a = handle({ request, env: {} }), b = handle({ request, env: {} });
  await new Promise(resolve => setImmediate(resolve));
  finish();
  assert.equal((await a).status, 200); assert.equal((await b).status, 200); assert.equal(reads, 1);
  const failed = createOverviewHandler({ authorizeFn: async () => ({}), readFn: async () => { throw new OverviewError('UPSTREAM_FAILED'); } });
  assert.deepEqual(await (await failed({ request, env: {} })).json(), { error: { code: 'UPSTREAM_FAILED' } });
});
