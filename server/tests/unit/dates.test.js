const {
  isValidDateString,
  getTodayUtcString,
  parseUtcDate,
  formatUtcDate,
  calculateNights,
  getStayNights,
} = require('../../src/utils/dates');

describe('Date Utilities Unit Tests', () => {
  it('should validate correct YYYY-MM-DD date strings', () => {
    expect(isValidDateString('2026-11-20')).toBe(true);
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('invalid-date')).toBe(false);
    expect(isValidDateString('2026-13-45')).toBe(false);
  });

  it('should parse and format UTC midnight dates consistently', () => {
    const d = parseUtcDate('2026-11-15');
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(10); // 0-indexed November
    expect(d.getUTCDate()).toBe(15);
    expect(formatUtcDate(d)).toBe('2026-11-15');
  });

  it('should accurately calculate stay nights', () => {
    expect(calculateNights('2026-11-10', '2026-11-13')).toBe(3);
    expect(calculateNights('2026-11-10', '2026-11-11')).toBe(1);
    expect(calculateNights('2026-11-10', '2026-11-10')).toBe(0);
  });

  it('should return date strings for occupied nights excluding check-out date', () => {
    const nights = getStayNights('2026-11-10', '2026-11-13');
    expect(nights).toEqual(['2026-11-10', '2026-11-11', '2026-11-12']);
    expect(nights).not.toContain('2026-11-13'); // Check-out date is NOT an occupied night
  });
});

