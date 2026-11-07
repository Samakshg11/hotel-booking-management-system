const { calculateStayPrice, formatCurrency } = require('../../src/utils/money');

describe('Money & Pricing Utilities Unit Tests', () => {
  it('should compute itemized stay prices with integer minor units (paise) and tax rounding', () => {
    const nightlyRates = [
      { date: '2026-11-10', rate: 450000 }, // ₹4,500
      { date: '2026-11-11', rate: 450000 },
      { date: '2026-11-12', rate: 550000 }, // Weekend surge override: ₹5,500
    ];

    const pricing = calculateStayPrice(nightlyRates, 0.12, 0);

    expect(pricing.subtotal).toBe(1450000); // ₹14,500
    expect(pricing.taxRate).toBe(0.12);
    expect(pricing.tax).toBe(174000); // 12% of 14,500 is 1,740 = 174000 paise
    expect(pricing.total).toBe(1624000); // ₹16,240
    expect(pricing.nightly.length).toBe(3);
  });

  it('should format paise into Indian Rupee currency strings', () => {
    const formatted = formatCurrency(500000);
    expect(formatted).toContain('5,000');
  });
});

