const bookingHoldService = require('../services/bookingHoldService');

/**
 * Booking Controller (Thin HTTP layer)
 */

async function holdBooking(req, res, next) {
  try {
    const { roomTypeId, checkIn, checkOut, guests, guestDetails } = req.body;

    const booking = await bookingHoldService.holdBooking({
      guestId: req.user.id,
      roomTypeId,
      checkIn,
      checkOut,
      guests: Number(guests),
      guestDetails: {
        fullName: guestDetails?.fullName || req.user.name,
        email: guestDetails?.email || req.user.email,
        phone: guestDetails?.phone || req.user.phone || '',
      },
      actorRole: req.user.role,
    });

    res.status(201).json({ data: booking });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  holdBooking,
};

