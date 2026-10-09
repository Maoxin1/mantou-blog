import test from 'node:test';
import assert from 'node:assert/strict';
import { completePeriods } from '../../functions/_lib/analytics-domain.mjs';

test('TM-OVW-001 excludes today and returns adjacent complete Beijing 7-day periods', () => {
  assert.deepEqual(completePeriods(Date.parse('2026-10-09T08:30:00Z')), {
    current: { from: '2026-10-01T16:00:00.000Z', to: '2026-10-08T16:00:00.000Z' },
    previous: { from: '2026-09-24T16:00:00.000Z', to: '2026-10-01T16:00:00.000Z' },
    timezone: 'Asia/Shanghai',
  });
});

test('TM-OVW-001 Beijing midnight, leap day and year boundary use complete days', () => {
  assert.equal(completePeriods(Date.parse('2026-10-08T15:59:59.999Z')).current.to, '2026-10-07T16:00:00.000Z');
  assert.equal(completePeriods(Date.parse('2026-10-08T16:00:00Z')).current.to, '2026-10-08T16:00:00.000Z');
  assert.equal(completePeriods(Date.parse('2024-03-01T00:00:00Z')).current.from, '2024-02-22T16:00:00.000Z');
  assert.equal(completePeriods(Date.parse('2027-01-01T00:00:00Z')).current.from, '2026-12-24T16:00:00.000Z');
  assert.throws(() => completePeriods(NaN), /Invalid clock/);
});

test('TM-OVW-001 seeded date property checks; seed=20261009, samples=256', () => {
  let seed = 20261009;
  const start = Date.parse('2020-01-01T00:00:00Z');
  const span = Date.parse('2036-01-01T00:00:00Z') - start;
  for (let sample = 0; sample < 256; sample++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const now = start + Math.floor((seed >>> 0) / 0x100000000 * span);
    const result = completePeriods(now);
    const context = `seed=20261009 sample=${sample} now=${now}`;
    const end = Date.parse(result.current.to);
    assert.equal(end - Date.parse(result.current.from), 7 * 86_400_000, context);
    assert.equal(Date.parse(result.previous.to), Date.parse(result.current.from), context);
    assert.equal(end - Date.parse(result.previous.from), 14 * 86_400_000, context);
    assert.equal((end + 8 * 3_600_000) % 86_400_000, 0, context);
    assert.ok(end <= now && now - end < 86_400_000, context);
  }
});
