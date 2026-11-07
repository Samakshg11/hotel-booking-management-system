const RateOverride = require('../models/RateOverride');
const env = require('../config/env');
const { getStayNights } = require('../utils/dates');
const { calculateStayPrice } = require('../utils/money');

/**
 * Pricing Service: Recomputes prices strictly server-side.
 * Stores and calculates money as integer minor units (paise). Never trust client totals.
 */
async function calculateStayPricing(roomType, checkIn, checkOut) {
  const stayNights = getStayNights(checkIn, checkOut);

  // Fetch any active rate overrides for this room type spanning stay dates
  const overrides = await RateOverride.find({
    roomTypeId: roomType._id,
    startDate: { $lte: checkOut },
    endDate: { $gte: checkIn },
  }).lean();

  const nightlyRates = stayNights.map((date) => {
    // Check if any override applies to this specific date
    const matchingOverride = overrides.find(
      (ov) => date >= ov.startDate && date <= ov.endDate
    );

    const rate = matchingOverride ? matchingOverride.rate : roomType.baseRate;
    return {
      date,
      rate, // paise
    };
  });

  return calculateStayPrice(nightlyRates, env.TAX_RATE, 0);
}

module.exports = {
  calculateStayPricing,
};
