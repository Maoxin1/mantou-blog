export const MARKET_BASE = 'https://data-api.binance.vision/api/v3/';
export const FIRST_MONTH = Date.UTC(2017, 7, 1);
export const FIRST_WEEK = Date.UTC(2017, 7, 14);
export const WEEK = 7 * 24 * 60 * 60 * 1000;
export const QUOTE_MAX_AGE = 120000;

function numeric(value) {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') throw new Error('Missing numeric field');
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('Invalid numeric field');
  return n;
}

export function parseQuote(raw, now = Date.now()) {
  if (!raw || raw.symbol !== 'BTCUSDT') throw new Error('Unexpected quote symbol');
  const price = numeric(raw.lastPrice), change = numeric(raw.priceChangePercent), time = numeric(raw.closeTime);
  if (price <= 0 || !Number.isSafeInteger(time) || time < FIRST_MONTH || time > now + 60000) throw new Error('Invalid quote');
  return { price, change, time, fresh: now - time <= QUOTE_MAX_AGE };
}

export function parseHistory(raw, now = Date.now(), frequency = 'monthly') {
  if (!['monthly', 'weekly'].includes(frequency)) throw new Error('Unexpected interval');
  if (!Array.isArray(raw) || raw.length === 0 || raw.length >= 1000) throw new Error('Incomplete history');
  const weekly = frequency === 'weekly';
  const current = weekly ? FIRST_WEEK + Math.floor((now - FIRST_WEEK) / WEEK) * WEEK
    : Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1);
  const rows = []; let expected = weekly ? FIRST_WEEK : FIRST_MONTH;
  for (const r of raw) {
    if (!Array.isArray(r) || r.length < 7) throw new Error('Invalid candle');
    const time = numeric(r[0]), end = numeric(r[6]), open = numeric(r[1]), close = numeric(r[4]);
    if (time >= current) continue;
    const date = new Date(time), next = weekly ? time + WEEK : Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
    if (time !== expected || end !== next - 1 || open <= 0 || close <= 0 || end >= now) throw new Error('Missing or invalid period');
    rows.push({ period: date.toISOString().slice(0, weekly ? 10 : 7), time, end, open, close, partial: rows.length === 0 }); expected = next;
  }
  if (rows.length < 2 || expected !== current) throw new Error('History is not current');
  return rows;
}

export async function marketJSON(path, { signal } = {}) {
  const response = await fetch(MARKET_BASE + path, { signal, mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Market request failed');
  return response.json();
}
