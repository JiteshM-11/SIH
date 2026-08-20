// Deterministic mock diagnostics, derived from the account's email + purchase
// date, so the same user always sees consistent (but evolving) numbers.
// Swap this out for a real device/telemetry feed in production.

function seededRand(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function buildMetrics(user) {
  const seed = user.email.split('').reduce((a, c) => a + c.charCodeAt(0), 0) || 42;
  const purchase = new Date(user.purchaseDate || '2024-01-01').getTime();
  const ageDays = Math.max(1, Math.round((Date.now() - purchase) / 86400000));

  const soh = Math.max(60, Math.round(100 - ageDays / 22 - seededRand(seed) * 6));
  const cycles = Math.round(ageDays / 1.6);
  const temp = Math.round(24 + seededRand(seed * 2) * 10);
  const fast = Math.round(seededRand(seed * 3) * 40);
  const safety = soh > 85 ? 'Low risk' : soh > 70 ? 'Monitor' : 'Elevated risk';

  return {
    soh, cycles, temp, fast, safety, ageDays,
    safetyNote: safety === 'Low risk' ? 'No active alerts' : 'Reduce fast-charge frequency',
    fastNote: fast > 25
      ? `${fast}% of sessions — higher than recommended, adds heat stress`
      : `${fast}% of sessions — within a healthy range`,
    dodNote: 'Mostly partial cycles — gentle on capacity fade',
    fullChargeNote: `${(ageDays % 5)}h/week average — keep below 2h where possible`,
    calendarNote: `${Math.round(ageDays / 30)} months in service`,
    chargeWindow: 'Charge to 80% for daily use · charge to 100% only before long trips · avoid fast-charging below 10% state of charge',
  };
}

module.exports = { buildMetrics, seededRand };
