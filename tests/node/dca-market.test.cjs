const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fixture = require('../../data/dca.json');
const modulePromise = import(pathToFileURL(path.resolve(__dirname, '../../assets/js/dca-market.mjs')).href);
const now = Date.UTC(2026, 9, 8, 10);
const candles = kind => fixture[kind].map(r => [r.time, r.open, 0, 0, r.close, 0, r.end]);
for (const kind of ['monthly', 'weekly']) {
  test(`DCA ${kind} history covers the source maximum and rejects gaps or incomplete coverage`, async () => {
    const { parseHistory, WEEK } = await modulePromise;
    const parsed = parseHistory(candles(kind), now, kind);
    assert.equal(parsed.length, fixture[kind].length);
    assert.equal(parsed[0].partial, true);
    assert.ok(parsed.slice(1).every(r => !r.partial));
    if (kind === 'weekly') {
      assert.equal(parsed[1].period, '2017-08-21');
      assert.ok(parsed.every(r => new Date(r.time).getUTCDay() === 1 && r.end === r.time + WEEK - 1));
      const rollover = parsed.filter(r => r.period >= '2020-12-21' && r.period <= '2021-01-11');
      assert.deepEqual(rollover.map(r => r.period), ['2020-12-21','2020-12-28','2021-01-04','2021-01-11']);
    } else assert.equal(parsed[1].period, '2017-09');
    const time=fixture[kind].at(-1).end+1;
    const end=kind==='weekly'?time+WEEK-1:Date.UTC(2026,10,1)-1;
    assert.equal(parseHistory([...candles(kind),[time,1,0,0,1,0,end]],now,kind).length,parsed.length);
    for (const rows of [[],candles(kind).slice(1),candles(kind).slice(0,-1),[...candles(kind).slice(0,2),...candles(kind).slice(3)],[...candles(kind),candles(kind).at(-1)]]) assert.throws(()=>parseHistory(rows,now,kind));
    for (const field of [null,'','NaN',-1]) { const rows=candles(kind);rows[0][1]=field;assert.throws(()=>parseHistory(rows,now,kind)); }
    const bad=candles(kind);bad[1][6]++;assert.throws(()=>parseHistory(bad,now,kind));
  });
}
test('DCA quote validates symbol, time, price and freshness', async () => {
  const { parseQuote } = await modulePromise;
  const quote={symbol:'BTCUSDT',lastPrice:'83000',priceChangePercent:'-1.2',closeTime:now};
  assert.equal(parseQuote(quote,now).fresh,true);
  assert.equal(parseQuote({...quote,closeTime:now-180000},now).fresh,false);
  for (const override of [{symbol:'BTCUSD'},{lastPrice:null},{lastPrice:'Infinity'},{lastPrice:'0'},{closeTime:now+120000},{priceChangePercent:''}]) assert.throws(()=>parseQuote({...quote,...override},now));
});
