const DAY = 86_400_000;
const BEIJING_OFFSET = 8 * 3_600_000;

export function completePeriods(now = Date.now()) {
  if (!Number.isFinite(now)) throw new TypeError('Invalid clock');
  const end = Math.floor((now + BEIJING_OFFSET) / DAY) * DAY - BEIJING_OFFSET;
  const iso = value => new Date(value).toISOString();
  return {
    current: { from: iso(end - 7 * DAY), to: iso(end) },
    previous: { from: iso(end - 14 * DAY), to: iso(end - 7 * DAY) },
    timezone: 'Asia/Shanghai',
  };
}

export function metricChange(current, previous) {
  for (const value of [current, previous]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new TypeError('Invalid metric');
  }
  return {
    absolute: current - previous,
    percent: previous === 0 ? null : (current - previous) / previous * 100,
    zeroBaseline: previous === 0,
  };
}
