export const DAY = 86400000;
export const FIRST_PRICE = Date.UTC(2010, 6, 18);
export const PRICE_URL = 'https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=PriceUSD&frequency=1d&start_time=2010-07-18&page_size=10000';

export class PriceHistoryError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function isCurrentPriceHistory(daily, now = Date.now()) {
  return Date.parse(daily.at(-1)?.[0] + 'T00:00:00Z') === Math.floor(now / DAY) * DAY - DAY;
}

export function parsePriceHistory(raw, now = Date.now(), { allowPublicationLag = false } = {}) {
  if (!raw || !Array.isArray(raw.data) || !raw.data.length || raw.next_page_url || raw.next_page_token || raw.next_page) throw new PriceHistoryError('invalid', 'Incomplete price history');
  const today = Math.floor(now / DAY) * DAY;
  let expected = FIRST_PRICE;
  const rows = raw.data.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new PriceHistoryError('invalid', 'Invalid daily row');
    const time = typeof row.time === 'string' ? Date.parse(row.time) : NaN;
    const price = (typeof row.PriceUSD === 'number' || typeof row.PriceUSD === 'string') && String(row.PriceUSD).trim() !== '' ? Number(row.PriceUSD) : NaN;
    if (row.asset !== 'btc' || time !== expected || time >= today || !Number.isFinite(price) || price <= 0) throw new PriceHistoryError('invalid', 'Missing or invalid daily price');
    expected += DAY;
    return [new Date(time).toISOString().slice(0, 10), price];
  });
  if (expected !== today && !(allowPublicationLag && expected === today - DAY)) throw new PriceHistoryError('pending', 'Price history is not current');
  return rows;
}

export async function priceHistoryJSON({ signal } = {}) {
  const response = await fetch(PRICE_URL, { signal, mode: 'cors', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error('Price history request failed');
  return response.json();
}
