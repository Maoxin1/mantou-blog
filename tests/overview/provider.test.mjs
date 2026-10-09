import test from 'node:test';
import assert from 'node:assert/strict';
import { readOverview } from '../../functions/_lib/provider.mjs';
const env = { ANALYTICS_API_TOKEN: 'fixture-not-real', ANALYTICS_ACCOUNT_ID: 'a'.repeat(32),
  ANALYTICS_SITE_TAG: 'b'.repeat(32), ANALYTICS_HOST: 'mantou-blog.pages.dev' };
const now = Date.parse('2026-10-09T00:00:00Z');
const row = (count = 26, visits = 10) => ({ count, sum: { visits }, avg: { sampleInterval: 1 } });
function mock(result) {
  return async (url, init) => {
    assert.equal(url, 'https://api.cloudflare.com/client/v4/graphql');
    const query = JSON.parse(init.body).query;
    assert.ok(query.includes('siteTag: "' + env.ANALYTICS_SITE_TAG + '"'));
    assert.ok(query.includes('requestHost: "mantou-blog.pages.dev"'));
    assert.equal(init.headers.Authorization, 'Bearer fixture-not-real');
    return new Response(JSON.stringify({ data: { viewer: { accounts: [result(query)] } } }), { headers: { 'Content-Type': 'application/json' } });
  };
}
const successful = mock(query => {
  if (query.includes('previous:')) return { current: [row(26, 10)], previous: [row(0, 0)] };
  if (query.includes('day0:')) return Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`day${i}`, [row(i, 1)]]));
  if (query.includes('paths:')) return { paths: [{ ...row(), dimensions: { requestPath: '/p/20260803/' } }] };
  return { sources: [{ ...row(), dimensions: { refererHost: '' } }] };
});

test('TM-OVW-004 reads both periods, daily counts and ranked paths/sources under fixed site filters', async () => {
  const result = await readOverview(env, { fetcher: successful, now });
  assert.equal(result.metrics.pv.current, 26);
  assert.equal(result.metrics.pv.percent, null);
  assert.equal(result.trend.length, 7);
  assert.equal(result.paths[0].path, '/p/20260803/');
  assert.equal(result.sources[0].source, '');
  assert.equal(result.periods.current.to, '2026-10-08T16:00:00.000Z');
});

test('TM-OVW-004 valid empty aggregates are explicit zero, missing/partial/HTTP failures are not zero', async () => {
  const empty = mock(query => query.includes('previous:') ? { current: [], previous: [] } :
    query.includes('day0:') ? Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`day${i}`, []])) :
    query.includes('paths:') ? { paths: [] } : { sources: [] });
  assert.equal((await readOverview(env, { fetcher: empty, now })).metrics.pv.current, 0);
  for (const fetcher of [mock(() => ({})), async () => new Response('{}', { status: 403 }),
    async () => new Response(JSON.stringify({ data: {}, errors: [{ message: 'partial error' }] })),
    async () => { throw new Error('network unavailable'); }]) {
    await assert.rejects(readOverview(env, { fetcher, now }), error => ['UPSTREAM_FAILED', 'INVALID_DATA'].includes(error.code));
  }
  await assert.rejects(readOverview({}, { fetcher: successful, now }), error => error.code === 'SETUP_REQUIRED');
});

test('TM-OVW-009 schema-confirmed bot filter is identical for totals, days and rankings', async () => {
  let requests = 0;
  const observed = [];
  const fetcher = async (url, init) => {
    requests++;
    const query = JSON.parse(init.body).query;
    const filters = query.match(/filter: \{ datetime_geq:[^}]+\}/g) ?? [];
    observed.push({ datasets: (query.match(/rumPageloadEventsAdaptiveGroups\(/g) ?? []).length, filters });
    return successful(url, init);
  };
  const result = await readOverview(env, { fetcher, now });
  assert.ok(requests > 0);
  for (const { datasets, filters } of observed) {
    assert.ok(datasets > 0);
    assert.equal(filters.length, datasets, 'every RUM selection must have an interval filter');
    for (const filter of filters) assert.match(filter, /bot:\s*0\b/, 'use schema-confirmed non-bot flag for every interval and ranking');
  }
  assert.equal(result.filters.bot, 0);
  assert.equal(result.filters.botExclusion, 'excluded-classified-bots');
});

test('TM-OVW-004 sampled API estimates are retained without multiplying the sampling interval', async () => {
  const fetcher = mock(query => {
    const sampled = { ...row(26, 10), avg: { sampleInterval: 4 } };
    if (query.includes('previous:')) return { current: [sampled], previous: [sampled] };
    if (query.includes('day0:')) return Object.fromEntries(Array.from({ length: 7 }, (_, i) => ['day' + i, [sampled]]));
    if (query.includes('paths:')) return { paths: [{ ...sampled, dimensions: { requestPath: '/p/20260803/' } }] };
    return { sources: [{ ...sampled, dimensions: { refererHost: '' } }] };
  });
  const result = await readOverview(env, { fetcher, now });
  assert.equal(result.metrics.pv.current, 26);
  assert.equal(result.metrics.visits.current, 10);
  assert.equal(result.sampling.current, 4);
  assert.equal(result.trend[0].pv, 26);
});
