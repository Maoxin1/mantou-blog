import test from 'node:test';
import assert from 'node:assert/strict';
import { metricChange } from '../../functions/_lib/analytics-domain.mjs';

test('TM-OVW-002 exposes absolute change and never divides by a zero baseline', () => {
  assert.deepEqual(metricChange(26, 0), { absolute: 26, percent: null, zeroBaseline: true });
  assert.deepEqual(metricChange(0, 0), { absolute: 0, percent: null, zeroBaseline: true });
  assert.deepEqual(metricChange(150, 100), { absolute: 50, percent: 50, zeroBaseline: false });
  assert.deepEqual(metricChange(25, 100), { absolute: -75, percent: -75, zeroBaseline: false });
  for (const invalid of [null, undefined, -1, NaN, Infinity, '26']) {
    assert.throws(() => metricChange(invalid, 20), /Invalid metric/);
  }
});
