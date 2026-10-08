const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fixture = require('../../data/btcprices.json');
const modulePromise = import(pathToFileURL(path.resolve(__dirname, '../../assets/js/btc-prices.mjs')).href);
const now = Date.UTC(2026, 9, 8, 10);
const response = () => ({ data: fixture.daily.map(([date, price]) => ({ asset: 'btc', time: date + 'T00:00:00.000000000Z', PriceUSD: String(price) })) });

test('BTC dollar history covers every UTC day from July 2010 through the latest closed day', async () => {
  const { parsePriceHistory } = await modulePromise;
  const rows = parsePriceHistory(response(), now);
  assert.deepEqual(rows, fixture.daily);
  assert.equal(rows.length, 5926);
  assert.deepEqual(rows[0], ['2010-07-18', 0.08584]);
  assert.equal(rows.at(-1)[0], '2026-10-07');
  assert.equal(rows.at(-1)[1], 83273.7243755582);
});

test('BTC dollar history rejects gaps, duplicates, shortened coverage, pagination and current-day prices', async () => {
  const { parsePriceHistory } = await modulePromise;
  const raw = response();
  for (const data of [[], raw.data.slice(1), raw.data.slice(0, -1), [...raw.data.slice(0, 10), ...raw.data.slice(11)], [...raw.data, raw.data.at(-1)], [...raw.data, { asset: 'btc', time: '2026-10-08T00:00:00Z', PriceUSD: '83000' }]]) assert.throws(() => parsePriceHistory({ data }, now));
  for (const next of ['next_page_url', 'next_page_token', 'next_page']) assert.throws(() => parsePriceHistory({ ...raw, [next]: 'more' }, now));
});

test('BTC dollar history rejects invalid prices, assets and non-daily timestamps', async () => {
  const { parsePriceHistory } = await modulePromise;
  for (const patch of [{PriceUSD:null},{PriceUSD:''},{PriceUSD:' '},{PriceUSD:'NaN'},{PriceUSD:'Infinity'},{PriceUSD:0},{PriceUSD:-1},{asset:'eth'},{time:'invalid'},{time:'2010-07-18T01:00:00Z'}]) {
    const raw = response(); Object.assign(raw.data[0], patch);
    assert.throws(() => parsePriceHistory(raw, now));
  }
});
