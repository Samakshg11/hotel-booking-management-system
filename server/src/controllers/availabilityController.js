const { searchAvailability } = require('../services/availabilityService');

/**
 * Availability Search Controller
 */
async function getAvailability(req, res, next) {
  try {
    const { checkIn, checkOut, guests, roomTypeId, page, limit } = req.query;

    const result = await searchAvailability({
      checkIn,
      checkOut,
      guests: guests ? Number(guests) : 1,
      roomTypeId: roomTypeId || null,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });

    res.status(200).json({
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAvailability,
};
