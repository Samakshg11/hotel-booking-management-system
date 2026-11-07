const { BadRequestError } = require('../utils/errors');

/**
 * Deterministic Simulated Payment Gateway (SANDBOX)
 * Card ending in 0000 fails with PAYMENT_DECLINED; all other cards succeed.
 */
async function processSimulatedPayment({ bookingReference, amount, cardNumber }) {
  const sanitizedCard = (cardNumber || '').replace(/\s+/g, '');

  if (sanitizedCard.endsWith('0000')) {
    throw new BadRequestError('Payment was declined by card issuer', null, 'PAYMENT_DECLINED');
  }

  const providerRef = `SANDBOX-TX-${bookingReference}-${Date.now()}`;

  return {
    success: true,
    status: 'SUCCEEDED',
    method: 'SANDBOX',
    providerRef,
    amount,
  };
}

module.exports = {
  processSimulatedPayment,
};

