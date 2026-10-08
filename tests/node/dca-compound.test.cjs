const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const modulePromise = import(pathToFileURL(path.resolve(__dirname, '../../assets/js/dca-compound.mjs')).href);
const base = { initial: 1000, contribution: 100, years: 1, annualRate: 0, frequency: 'monthly' };
const close = (actual, expected) => assert.ok(
  Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10,
  `${actual} should be approximately ${expected}`,
);

for (const [frequency, periodsPerYear, total] of [['monthly', 12, 2200], ['weekly', 52, 6200]]) {
  test(`compound ${frequency}: zero returns preserve all contributions`, async () => {
    const { simulateCompound } = await modulePromise;
    const result = simulateCompound({ ...base, frequency });
    assert.equal(result.periodsPerYear, periodsPerYear);
    assert.equal(result.value, total);
    assert.equal(result.invested, total);
    assert.equal(result.gain, 0);
    assert.equal(result.balances.length, periodsPerYear + 1);
    assert.deepEqual(result.balances, result.contributions);
    assert.equal(result.balances[0], 1000);
    assert.equal(result.balances[1], 1100);
  });

  test(`compound ${frequency}: effective annual returns remain 5% without additions`, async () => {
    const { simulateCompound } = await modulePromise;
    const result = simulateCompound({ ...base, contribution: 0, annualRate: 5, frequency });
    close(result.value, 1050);
    close(result.gain, 50);
    assert.equal(result.invested, 1000);
    assert.ok(result.contributions.every(value => value === 1000));
  });

  test(`compound ${frequency}: positive and negative returns match an ordinary annuity`, async () => {
    const { simulateCompound } = await modulePromise;
    for (const annualRate of [-20, -5, 5, 20]) {
      const input = { ...base, initial: 1234.56, contribution: 78.9, years: 17, annualRate, frequency };
      const growth = Math.pow(1 + annualRate / 100, input.years);
      const periodRate = Math.pow(1 + annualRate / 100, 1 / periodsPerYear) - 1;
      const expected = input.initial * growth + input.contribution * (growth - 1) / periodRate;
      const result = simulateCompound(input);
      close(result.value, expected);
      close(result.balances[1], input.initial * (1 + periodRate) + input.contribution);
      close(result.invested, input.initial + input.contribution * input.years * periodsPerYear);
      close(result.gain, expected - result.invested);
      assert.equal(Math.sign(result.gain), Math.sign(annualRate));
      assert.equal(result.balances.length, input.years * periodsPerYear + 1);
    }
  });
}

test('compound accepts boundary inputs and preserves a zero balance', async () => {
  const { simulateCompound } = await modulePromise;
  for (const frequency of ['monthly', 'weekly']) {
    for (const annualRate of [-20, 0, 20]) {
      const zero = simulateCompound({ initial: 0, contribution: 0, years: 40, annualRate, frequency });
      assert.equal(zero.value, 0);
      assert.equal(zero.gain, 0);
      const maximum = simulateCompound({ initial: 10000000, contribution: 100000, years: 40, annualRate, frequency });
      assert.ok(Number.isFinite(maximum.value) && maximum.value > 0);
      assert.equal(maximum.invested, 10000000 + 100000 * 40 * maximum.periodsPerYear);
    }
  }
});

test('compound rejects out-of-range, fractional-year, nonnumeric and invalid-frequency inputs', async () => {
  const { simulateCompound } = await modulePromise;
  const invalid = {
    initial: [-1, 10000001, NaN, Infinity, -Infinity, '1000', null, undefined],
    contribution: [-1, 100001, NaN, Infinity, '100', null, undefined],
    years: [0, 41, 1.5, NaN, Infinity, '1', null, undefined],
    annualRate: [-20.01, 20.01, NaN, Infinity, '5', null, undefined],
    frequency: ['', 'daily', 'Monthly', 'toString', 52, null, undefined],
  };
  for (const [field, values] of Object.entries(invalid)) {
    for (const value of values) {
      assert.throws(() => simulateCompound({ ...base, [field]: value }), RangeError, `${field}: ${String(value)}`);
    }
  }
  assert.throws(() => simulateCompound());
});
