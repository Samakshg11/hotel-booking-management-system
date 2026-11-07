const { generateBookingReference } = require('../../src/utils/reference');

describe('Booking Reference Generator Unit Tests', () => {
  it('should generate valid references formatted as HB-YYYYMMDD-XXXXX', () => {
    const fixedDate = new Date('2026-12-01T00:00:00Z');
    const ref = generateBookingReference(fixedDate);

    expect(ref).toMatch(/^HB-20261201-[0-9A-Z]{5}$/);
    expect(ref.length).toBe(17);
  });

  it('should produce distinct references across multiple calls', () => {
    const refs = new Set();
    for (let i = 0; i < 100; i++) {
      refs.add(generateBookingReference());
    }
    expect(refs.size).toBe(100);
  });
});

