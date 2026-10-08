const { test } = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('../../data/btcprices.json');
const modulePromise = import('../../assets/js/dca-history.mjs');
const DAY = 86400000, time = day => Date.parse(day + 'T00:00:00Z');
const sample = (first, last) => Array.from({ length: (time(last) - time(first)) / DAY + 1 }, (_, i) => [new Date(time(first) + i * DAY).toISOString().slice(0, 10), (i + 1) * 10]);

test('USD reference DCA covers the earliest complete 2010 week/month through the last complete periods', async () => {
  const { referencePeriods } = await modulePromise;
  const weeks = referencePeriods(fixture.daily, 'weekly'), months = referencePeriods(fixture.daily, 'monthly');
  assert.equal(weeks.length, 846); assert.equal(months.length, 194);
  assert.equal(weeks[0].period, '2010-07-19'); assert.equal(weeks[0].buyPrice, 0.08584);
  assert.equal(weeks.at(-1).period, '2026-09-28'); assert.equal(weeks.at(-1).end, time('2026-10-05') - 1);
  assert.equal(months[0].period, '2010-08'); assert.equal(months.at(-1).period, '2026-09');
  assert.ok(weeks.every(r => new Date(r.time).getUTCDay() === 1 && r.valuationTime === r.time + 7 * DAY));
  assert.ok(months.every(r => new Date(r.time).getUTCDate() === 1));
});

test('DCA buys only the previously known close and values at the end of each full period', async () => {
  const { referencePeriods } = await modulePromise, daily = sample('2010-07-18', '2010-08-31');
  const weeks = referencePeriods(daily, 'weekly'), months = referencePeriods(daily, 'monthly');
  assert.equal(weeks[0].buyPrice, 10); assert.equal(weeks[0].valuePrice, 80);
  assert.equal(weeks[1].buyPrice, 80); assert.equal(weeks[1].valuePrice, 150);
  assert.equal(months[0].buyPrice, 140); assert.equal(months[0].valuePrice, 450);
  const edited = daily.map(([day, price]) => [day, day === '2010-07-19' ? 999 : price]);
  assert.equal(referencePeriods(edited, 'weekly')[0].buyPrice, 10);
});

test('Reference calendar handles leap February, year rollover and incomplete first/last periods', async () => {
  const { referencePeriods } = await modulePromise, daily = sample('2019-12-29', '2020-03-10');
  const weeks = referencePeriods(daily, 'weekly'), months = referencePeriods(daily, 'monthly');
  assert.equal(weeks[0].period, '2019-12-30'); assert.equal(weeks.at(-1).period, '2020-03-02');
  assert.deepEqual(months.map(r => r.period), ['2020-01', '2020-02']);
  assert.equal(months[1].end, time('2020-03-01') - 1);
  assert.equal(months[1].valuePrice, daily.find(([day]) => day === '2020-02-29')[1]);
  assert.equal(referencePeriods(sample('2010-07-19', '2010-07-25'), 'weekly').length, 0);
  assert.equal(referencePeriods(sample('2010-07-18', '2010-07-24'), 'weekly').length, 0);
  assert.equal(referencePeriods(sample('2010-07-18', '2010-07-25'), 'weekly').length, 1);
  assert.equal(referencePeriods(sample('2010-08-01', '2010-08-31'), 'monthly').length, 0);
});

test('Invalid, missing, duplicate or reordered daily prices cannot enter a reference backtest', async () => {
  const { referencePeriods } = await modulePromise, daily = sample('2010-07-18', '2010-08-31');
  for (const rows of [[], null, [daily[0], ...daily.slice(2)], [daily[0], ...daily], [...daily].reverse()]) assert.throws(() => referencePeriods(rows));
  for (const price of [0, -1, NaN, Infinity, null, '10']) assert.throws(() => referencePeriods([['2010-07-18', price]]));
  for (const day of ['invalid', '2020-02-30', '2010-7-18']) assert.throws(() => referencePeriods([[day, 10]]));
  assert.throws(() => referencePeriods(daily, 'daily'));
});
