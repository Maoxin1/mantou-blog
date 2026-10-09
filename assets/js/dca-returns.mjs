const DAY = 86400000;
const DATE_LIMIT = 8640000000000000;
const MAX_YEAR_SPAN = 1000;

const finiteNumber = value => typeof value === 'number' && Number.isFinite(value);

// Returns a decimal (0.1 means 10%). No invested capital means no return ratio.
export function cumulativeReturn(value, invested) {
  if (!finiteNumber(value) || !finiteNumber(invested) || value < 0 || invested <= 0) return null;
  const result = (value - invested) / invested;
  return Number.isFinite(result) ? result : null;
}

// Money-weighted annual return for this tool's cash flows: contributions followed
// by one terminal valuation. `years` is an elapsed year fraction, not a date.
// Coalesce simultaneous flows before checking signs, so the final contribution
// and valuation cancel correctly. Other withdrawal schedules are unsupported:
// accepting multiple sign changes could silently select one of several IRRs.
export function annualizedReturn(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
  const grouped = new Map();
  for (const flow of cashflows) {
    if (!flow || !finiteNumber(flow.amount) || !finiteNumber(flow.years) || flow.years < 0) return null;
    const amount = (grouped.get(flow.years) || 0) + flow.amount;
    if (!Number.isFinite(amount)) return null;
    grouped.set(flow.years, amount);
  }
  const rows = [...grouped].filter(([, amount]) => amount !== 0).sort((a, b) => a[0] - b[0]);
  if (rows.length < 2) return null;
  const [end, terminal] = rows.at(-1);
  if (terminal <= 0 || end - rows[0][0] <= 0 || end - rows[0][0] > MAX_YEAR_SPAN) return null;
  const contributions = rows.slice(0, -1);
  if (contributions.some(([, amount]) => amount >= 0)) return null;
  const invested = contributions.reduce((sum, [, amount]) => sum - amount, 0);
  if (!Number.isFinite(invested)) return null;
  if (terminal === invested) return 0;

  // Solve terminal = sum(contribution * exp(log(1 + rate) * holdingYears)).
  // Log-sum-exp keeps even very large early-BTC returns from overflowing.
  const terms = contributions.map(([years, amount]) => ({ logAmount: Math.log(-amount), years: end - years }));
  const logTerminal = Math.log(terminal);
  const difference = logRate => {
    const powers = terms.map(term => term.logAmount + logRate * term.years);
    const largest = powers.reduce((maximum, power) => Math.max(maximum, power), -Infinity);
    return largest + Math.log(powers.reduce((sum, power) => sum + Math.exp(power - largest), 0)) - logTerminal;
  };

  // Only return rates strictly above -100% that fit a finite JavaScript number.
  // Outside this range the caller should display unavailable, not ±Infinity.
  let low = Math.log1p(-1 + Number.EPSILON / 2);
  let high = Math.log(Number.MAX_VALUE);
  if (difference(low) > 0 || difference(high) < 0) return null;
  for (let i = 0; i < 180; i++) {
    const middle = low + (high - low) / 2;
    if (middle === low || middle === high) break;
    if (difference(middle) > 0) high = middle;
    else low = middle;
  }
  const result = Math.expm1(low + (high - low) / 2);
  return Number.isFinite(result) && result > -1 ? result : null;
}

// ACT/365 XIRR: numeric epoch milliseconds are reduced to UTC calendar dates.
// Flows on the same day therefore net together even if their timestamps differ.
export function xirr(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length < 2) return null;
  if (cashflows.some(flow => !flow || !finiteNumber(flow.time) || Math.abs(flow.time) > DATE_LIMIT)) return null;
  const days = cashflows.map(flow => Math.floor(flow.time / DAY));
  const first = days.reduce((minimum, day) => Math.min(minimum, day), Infinity);
  return annualizedReturn(cashflows.map((flow, index) => ({ amount: flow.amount, years: (days[index] - first) / 365 })));
}
