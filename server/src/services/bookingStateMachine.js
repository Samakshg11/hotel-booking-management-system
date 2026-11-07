const { ConflictError } = require('../utils/errors');

/**
 * State machine: Single source of truth for all booking status transitions
 * Section 6:
 * const TRANSITIONS = {
 *   HELD: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
 *   CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
 *   CHECKED_IN: ['CHECKED_OUT'],
 *   CHECKED_OUT: [],
 *   CANCELLED: [],
 *   EXPIRED: [],
 * };
 */
const TRANSITIONS = {
  HELD: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED'],
  CHECKED_IN: ['CHECKED_OUT'],
  CHECKED_OUT: [],
  CANCELLED: [],
  EXPIRED: [],
};

/**
 * Validates whether transitioning from currentStatus to targetStatus is permitted.
 * Throws 409 INVALID_TRANSITION with { from, to } details if illegal.
 */
function validateBookingTransition(currentStatus, targetStatus) {
  const allowed = TRANSITIONS[currentStatus];

  if (!allowed || !allowed.includes(targetStatus)) {
    throw new ConflictError(
      `Cannot transition booking from ${currentStatus} to ${targetStatus}`,
      'INVALID_TRANSITION',
      { from: currentStatus, to: targetStatus }
    );
  }

  return true;
}

module.exports = {
  TRANSITIONS,
  validateBookingTransition,
};

