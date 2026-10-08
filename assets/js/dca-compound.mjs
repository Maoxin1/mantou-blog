/** Simulate fixed effective annual returns with contributions at each period end. */
export function simulateCompound({ initial, contribution, years, annualRate, frequency } = {}) {
  for (const [name, value, maximum] of [
    ['initial', initial, 10000000],
    ['contribution', contribution, 100000],
  ]) {
    if (!Number.isFinite(value) || value < 0 || value > maximum) {
      throw new RangeError(`${name} must be a finite number from 0 to ${maximum}.`);
    }
  }
  if (!Number.isInteger(years) || years < 1 || years > 40) {
    throw new RangeError('years must be an integer from 1 to 40.');
  }
  if (!Number.isFinite(annualRate) || annualRate < -20 || annualRate > 20) {
    throw new RangeError('annualRate must be a finite number from -20 to 20.');
  }
  if (frequency !== 'monthly' && frequency !== 'weekly') {
    throw new RangeError('frequency must be monthly or weekly.');
  }

  // A weekly year uses exactly 52 periods; this is not a calendar simulation.
  const periodsPerYear = frequency === 'weekly' ? 52 : 12;
  const periodRate = Math.expm1(Math.log1p(annualRate / 100) / periodsPerYear);
  const balances = [initial];
  const contributions = [initial];
  let value = initial;
  for (let period = 1; period <= years * periodsPerYear; period++) {
    value = value * (1 + periodRate) + contribution;
    balances.push(value);
    contributions.push(initial + contribution * period);
  }
  const invested = contributions.at(-1);
  return { invested, value, gain: value - invested, balances, contributions, periodsPerYear };
}
