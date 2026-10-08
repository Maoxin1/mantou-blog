import { DAY } from './btc-prices.mjs';

// PriceUSD labels a UTC day's close, available at 00:00 UTC on the next day.
export function referencePeriods(daily, frequency = 'weekly') {
  if (!['weekly', 'monthly'].includes(frequency) || !Array.isArray(daily) || !daily.length) throw new Error('Invalid reference history');
  const prices = new Map();
  let previous;
  for (const row of daily) {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row[0])) throw new Error('Invalid reference day');
    const time = Date.parse(row[0] + 'T00:00:00Z');
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== row[0] || (previous !== undefined && time !== previous + DAY) || !Number.isFinite(row[1]) || row[1] <= 0) throw new Error('Missing or invalid reference price');
    prices.set(time, row[1]); previous = time;
  }
  const weekly = frequency === 'weekly', available = Date.parse(daily[0][0] + 'T00:00:00Z') + DAY;
  const first = new Date(available);
  let time = weekly ? available + ((1 - first.getUTCDay() + 7) % 7) * DAY
    : Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + (first.getUTCDate() === 1 ? 0 : 1), 1);
  const through = previous + DAY, rows = [];
  while (time < through) {
    const start = new Date(time), next = weekly ? time + 7 * DAY : Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
    if (next > through) break;
    rows.push({ period: start.toISOString().slice(0, weekly ? 10 : 7), time, end: next - 1,
      buyPrice: prices.get(time - DAY), valuePrice: prices.get(next - DAY), valuationTime: next });
    time = next;
  }
  return rows;
}
