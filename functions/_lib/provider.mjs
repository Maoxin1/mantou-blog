import { completePeriods, metricChange } from './analytics-domain.mjs';
import { OverviewError } from './errors.mjs';

const ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';
const DAY = 86_400_000;
const string = value => JSON.stringify(value);

function counts(rows) {
  if (!Array.isArray(rows) || rows.length > 1) throw new OverviewError('INVALID_DATA');
  if (rows.length === 0) return { pv: 0, visits: 0, sampleInterval: 1 };
  const row = rows[0];
  for (const value of [row.count, row.sum?.visits]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) throw new OverviewError('INVALID_DATA');
  }
  const sample = row.avg?.sampleInterval;
  return { pv: row.count, visits: row.sum.visits, sampleInterval: typeof sample === 'number' && Number.isFinite(sample) && sample >= 1 ? sample : null };
}

export async function readOverview(env, { fetcher = fetch, now = Date.now() } = {}) {
  if (!env.ANALYTICS_API_TOKEN || !/^[a-f0-9]{32}$/.test(env.ANALYTICS_ACCOUNT_ID || '') ||
    !/^[a-f0-9]{32}$/.test(env.ANALYTICS_SITE_TAG || '') || env.ANALYTICS_HOST !== 'mantou-blog.pages.dev') {
    throw new OverviewError('SETUP_REQUIRED', 503);
  }
  const periods = completePeriods(now);
  // The authenticated RUM schema describes bot=0 as not classified as bot traffic.
  // Keep both periods, daily values and rankings consistent with the existing dashboard filter.
  const filter = period => `{ datetime_geq: ${string(period.from)}, datetime_lt: ${string(period.to)}, siteTag: ${string(env.ANALYTICS_SITE_TAG)}, requestHost: ${string(env.ANALYTICS_HOST)}, bot: 0 }`;
  const aggregate = (alias, period) => `${alias}: rumPageloadEventsAdaptiveGroups(limit: 1, filter: ${filter(period)}) { count sum { visits } avg { sampleInterval } }`;
  async function query(selection) {
    let response, body;
    try {
      response = await fetcher(ENDPOINT, { method: 'POST',
        headers: { Authorization: `Bearer ${env.ANALYTICS_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `query Overview { viewer { accounts(filter: {accountTag: ${string(env.ANALYTICS_ACCOUNT_ID)}}) { ${selection} } } }` }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('HTTP error');
      body = await response.json();
    } catch { throw new OverviewError('UPSTREAM_FAILED'); }
    if (body.errors?.length || body.data?.viewer?.accounts?.length !== 1) throw new OverviewError('UPSTREAM_FAILED');
    return body.data.viewer.accounts[0];
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = Date.parse(periods.current.from) + i * DAY;
    return { from: new Date(start).toISOString(), to: new Date(start + DAY).toISOString() };
  });
  const ranking = (alias, dimension) => `${alias}: rumPageloadEventsAdaptiveGroups(limit: 15, orderBy: [count_DESC], filter: ${filter(periods.current)}) { count sum { visits } dimensions { ${dimension} } }`;
  const [total, daily, rankedPaths, rankedSources] = await Promise.all([
    query(`${aggregate('current', periods.current)} ${aggregate('previous', periods.previous)}`),
    query(days.map((period, i) => aggregate(`day${i}`, period)).join(' ')),
    query(ranking('paths', 'requestPath')), query(ranking('sources', 'refererHost')),
  ]);
  const current = counts(total.current), previous = counts(total.previous);
  function ranks(rows, dimension, label) {
    if (!Array.isArray(rows) || rows.length > 15) throw new OverviewError('INVALID_DATA');
    return rows.map(row => {
      if (typeof row.dimensions?.[dimension] !== 'string') throw new OverviewError('INVALID_DATA');
      const values = counts([row]);
      return { [label]: row.dimensions[dimension], pv: values.pv, visits: values.visits };
    });
  }
  const change = key => ({ current: current[key], previous: previous[key], ...metricChange(current[key], previous[key]) });
  return {
    site: env.ANALYTICS_HOST, periods, queriedAt: new Date(now).toISOString(),
    metrics: { pv: change('pv'), visits: change('visits') },
    trend: days.map((period, i) => ({ date: new Date(Date.parse(period.from) + 8 * 3_600_000).toISOString().slice(0, 10), ...counts(daily[`day${i}`]) })),
    paths: ranks(rankedPaths.paths, 'requestPath', 'path'), sources: ranks(rankedSources.sources, 'refererHost', 'source'),
    sampling: { current: current.sampleInterval, previous: previous.sampleInterval },
    filters: { botExclusion: 'excluded-classified-bots', bot: 0, path: null },
    rankLimit: 15,
  };
}
