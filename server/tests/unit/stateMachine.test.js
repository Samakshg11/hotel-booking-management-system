const {
  TRANSITIONS,
  validateBookingTransition,
} = require('../../src/services/bookingStateMachine');
const { ConflictError } = require('../../src/utils/errors');

describe('Booking State Machine Unit Tests', () => {
  it('should permit documented valid state transitions', () => {
    expect(validateBookingTransition('HELD', 'CONFIRMED')).toBe(true);
    expect(validateBookingTransition('HELD', 'CANCELLED')).toBe(true);
    expect(validateBookingTransition('HELD', 'EXPIRED')).toBe(true);
    expect(validateBookingTransition('CONFIRMED', 'CHECKED_IN')).toBe(true);
    expect(validateBookingTransition('CONFIRMED', 'CANCELLED')).toBe(true);
    expect(validateBookingTransition('CHECKED_IN', 'CHECKED_OUT')).toBe(true);
  });

  it('should reject invalid state jumps and return 409 INVALID_TRANSITION with from and to details', () => {
    const invalidTransitions = [
      ['HELD', 'CHECKED_IN'],
      ['HELD', 'CHECKED_OUT'],
      ['CHECKED_OUT', 'CHECKED_IN'],
      ['CHECKED_OUT', 'CONFIRMED'],
      ['CANCELLED', 'CONFIRMED'],
      ['CANCELLED', 'CHECKED_IN'],
      ['EXPIRED', 'CONFIRMED'],
    ];

    invalidTransitions.forEach(([from, to]) => {
      try {
        validateBookingTransition(from, to);
        throw new Error(`Expected transition from ${from} to ${to} to fail`);
      } catch (err) {
        expect(err).toBeInstanceOf(ConflictError);
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe('INVALID_TRANSITION');
        expect(err.details).toEqual({ from, to });
      }
    });
  });
});

