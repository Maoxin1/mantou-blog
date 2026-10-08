const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fixture = require('../../data/dca.json');
const modulePromise = import(pathToFileURL(path.resolve(__dirname, '../../assets/js/dca-market.mjs')).href);
const now = Date.UTC(2026, 9, 8, 8);
const candles = () => fixture.monthly.map(r => [r.time, r.open, 0, 0, r.close, 0, r.end]);

test('DCA history rejects missing, duplicate, incomplete and malformed months', async () => {
  const { parseHistory } = await modulePromise;
  assert.equal(parseHistory(candles(), now).length, 105);
  const current = [Date.UTC(2026, 9, 1), 1, 0, 0, 1, 0, Date.UTC(2026, 10, 1)-1];
  assert.equal(parseHistory([...candles(), current], now).length, 105);
  for (const rows of [[], candles().slice(1), candles().slice(0,-1), [...candles().slice(0,2), ...candles().slice(3)], [...candles(), candles().at(-1)]]) {
    assert.throws(() => parseHistory(rows, now));
  }
  for (const field of [null, '', 'NaN', -1]) { const rows = candles(); rows[0][1] = field; assert.throws(() => parseHistory(rows, now)); }
  const badEnd = candles(); badEnd[0][6]++; assert.throws(() => parseHistory(badEnd, now));
});

test('DCA quote validates symbol, time, price and freshness without treating old data as live', async () => {
  const { parseQuote } = await modulePromise;
  const quote = {symbol:'BTCUSDT',lastPrice:'83000',priceChangePercent:'-1.2',closeTime:now};
  assert.equal(parseQuote(quote, now).fresh, true);
  assert.equal(parseQuote({...quote, closeTime:now-180000}, now).fresh, false);
  for (const override of [{symbol:'BTCUSD'}, {lastPrice:null}, {lastPrice:'Infinity'}, {lastPrice:'0'}, {closeTime:now+120000}, {priceChangePercent:''}]) assert.throws(() => parseQuote({...quote, ...override}, now));
});
