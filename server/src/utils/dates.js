/**
 * Date utilities enforcing UTC midnight semantics (YYYY-MM-DD)
 */

/**
 * Validates YYYY-MM-DD string format
 */
function isValidDateString(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateStr;
}

/**
 * Returns today's date formatted as YYYY-MM-DD in UTC
 */
function getTodayUtcString() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/**
 * Converts a YYYY-MM-DD string to a Date object set at UTC midnight
 */
function parseUtcDate(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/**
 * Formats a Date object to YYYY-MM-DD
 */
function formatUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Calculates number of nights between checkIn and checkOut
 */
function calculateNights(checkInStr, checkOutStr) {
  const checkIn = parseUtcDate(checkInStr);
  const checkOut = parseUtcDate(checkOutStr);
  const diffTime = checkOut.getTime() - checkIn.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Generates an array of date strings (YYYY-MM-DD) for each occupied night.
 * Note: check-out date is NOT an occupied night (enables same-day turnover).
 */
function getStayNights(checkInStr, checkOutStr) {
  const nights = [];
  const current = parseUtcDate(checkInStr);
  const checkOut = parseUtcDate(checkOutStr);

  while (current.getTime() < checkOut.getTime()) {
    nights.push(formatUtcDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return nights;
}

module.exports = {
  isValidDateString,
  getTodayUtcString,
  parseUtcDate,
  formatUtcDate,
  calculateNights,
  getStayNights,
};

