import test from 'node:test';
import assert from 'node:assert/strict';
import { protectResponse } from '../../functions/_lib/access-response.mjs';
test('TM-OVW-007 authorization wrapper preserves HTML and status while replacing cache headers', async () => {
  const wrapped = protectResponse(new Response('<h1>网站数据</h1>', { status: 200, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=3600' } }));
  assert.equal(await wrapped.text(), '<h1>网站数据</h1>');
  assert.equal(wrapped.status, 200);
  assert.equal(wrapped.headers.get('Content-Type'), 'text/html');
  assert.equal(wrapped.headers.get('Cache-Control'), 'private, no-store');
});
