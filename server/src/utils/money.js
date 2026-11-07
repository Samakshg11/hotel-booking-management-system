/**
 * Money utilities: All calculations use integer minor units (paise).
 * 1 INR = 100 paise. Never store or calculate money as floating point numbers.
 */

/**
 * Calculates itemized pricing for a stay
 * @param {Array<{date: string, rate: number}>} nightlyRates - array of nightly rates in paise
 * @param {number} taxRate - e.g. 0.12 (12%)
 * @param {number} fees - flat fees in paise (default 0)
 * @returns {{nightly: Array, subtotal: number, taxRate: number, tax: number, fees: number, total: number}}
 */
function calculateStayPrice(nightlyRates, taxRate = 0.12, fees = 0) {
  const subtotal = nightlyRates.reduce((acc, item) => acc + Math.round(item.rate), 0);
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax + fees;

  return {
    nightly: nightlyRates,
    subtotal,
    taxRate,
    tax,
    fees,
    total,
  };
}

/**
 * Formats paise integer to human-readable currency string (e.g. ₹4,500.00)
 */
function formatCurrency(paise, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(paise / 100);
}

module.exports = {
  calculateStayPrice,
  formatCurrency,
};

