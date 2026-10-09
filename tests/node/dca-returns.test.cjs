const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const modulePromise = import(pathToFileURL(path.resolve(__dirname, '../../assets/js/dca-returns.mjs')).href);
const DAY = 86400000;
const start = Date.UTC(2020, 0, 1);
const at = (days, amount) => ({ time: start + days * DAY, amount });
const close = (actual, expected, tolerance = 1e-10) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
};

test('cumulative return separates gains from capital and handles a full loss', async () => {
  const { cumulativeReturn } = await modulePromise;
  close(cumulativeReturn(110, 100), 0.1);
  close(cumulativeReturn(75, 100), -0.25);
  assert.equal(cumulativeReturn(0, 100), -1);
  assert.equal(cumulativeReturn(100, 0), null);
  for (const pair of [[100, -1], [-1, 100], ['100', 10], [100, NaN], [Infinity, 10], [null, 10]]) {
    assert.equal(cumulativeReturn(...pair), null);
  }
});

test('XIRR uses ACT/365 for a 365-day investment and uneven dated contributions', async () => {
  const { xirr } = await modulePromise;
  close(xirr([at(0, -100), at(365, 110)]), 0.1);
  close(xirr([at(0, -100), at(366, 100 * Math.pow(1.1, 366 / 365))]), 0.1);
  const value = 100 * Math.pow(1.12, 456 / 365) + 50 * Math.pow(1.12, (456 - 182) / 365);
  close(xirr([at(456, value), at(0, -100), at(182, -50)]), 0.12);
});

test('same UTC day contribution and terminal valuation are netted before finding a rate', async () => {
  const { xirr } = await modulePromise;
  close(xirr([at(0, -100), at(365, -50), { ...at(365, 200), time: start + 366 * DAY - 1 }]), 0.5);
  assert.equal(xirr([at(0, -100), { ...at(0, 150), time: start + DAY - 1 }]), null);
  assert.equal(xirr([at(0, -100), at(365, -50), at(365, 50)]), null);
  assert.equal(xirr([at(0, -100), at(365, -50), at(365, 25)]), null);
});

test('annualization supports losses and very high returns without Infinity or a rounded -100%', async () => {
  const { xirr } = await modulePromise;
  close(xirr([at(0, -100), at(365, 50)]), -0.5);
  close(xirr([at(0, -100), at(365, 1e-8)]), -0.9999999999);
  const huge = Math.expm1(Math.log(2000) * 365 / 30);
  close(xirr([at(0, -1000), at(30, 2000000)]), huge);
  assert.equal(xirr([at(0, -1), at(7, 1e9)]), null);
  assert.equal(xirr([at(0, -100), at(365, 1e-20)]), null);
});

test('invalid or unsupported flows return no annualized rate', async () => {
  const { annualizedReturn, xirr } = await modulePromise;
  for (const flows of [null, [], [at(0, -100)], [at(0, 100), at(365, 110)], [at(0, -100), at(365, 0)], [at(0, -100), at(365, -10)], [at(0, -100), at(100, 50), at(365, 100)], [at(0, -100), { amount: 110, time: Infinity }], [at(0, -100), { amount: 110, time: '2021-01-01' }], [at(0, -100), at(365, NaN)], [at(0, -100), at(365, '110')]]) {
    assert.equal(xirr(flows), null);
  }
  assert.equal(annualizedReturn([{ amount: -100, years: 0 }, { amount: 110, years: 0 }]), null);
  assert.equal(annualizedReturn([{ amount: 0, years: 0 }, { amount: 0, years: 1 }]), null);
  assert.equal(annualizedReturn([{ amount: -100, years: -1 }, { amount: 110, years: 1 }]), null);
  assert.equal(annualizedReturn([{ amount: -100, years: 0 }, { amount: 110, years: 1001 }]), null);
  assert.equal(annualizedReturn([{ amount: -Number.MAX_VALUE, years: 0 }, { amount: -Number.MAX_VALUE, years: 0 }, { amount: 110, years: 1 }]), null);
});

test('model cash flows recover the effective annual assumption for month-end and week-end contributions', async () => {
  const { annualizedReturn } = await modulePromise;
  for (const initial of [0, 1000]) {
   for (const periodsPerYear of [12, 52]) {
    for (const annual of [0.05, 0, -0.2]) {
      const contribution = 100, years = 10;
      const periodRate = Math.pow(1 + annual, 1 / periodsPerYear) - 1;
      let value = initial;
      const flows = [{ amount: -initial, years: 0 }];
      for (let i = 1; i <= years * periodsPerYear; i++) {
        value = value * (1 + periodRate) + contribution;
        flows.push({ amount: -contribution, years: i / periodsPerYear });
      }
      flows.push({ amount: value, years });
      close(annualizedReturn(flows), annual);
    }
   }
  }
});
