const bookingHoldService = require('../services/bookingHoldService');
const bookingService = require('../services/bookingService');

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

async function confirmBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { cardNumber } = req.body;
    const idempotencyKey = req.headers['idempotency-key'] || null;

    const result = await bookingService.confirmBooking({
      bookingId: id,
      userId: req.user.id,
      userRole: req.user.role,
      paymentDetails: { cardNumber },
      idempotencyKey,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function cancelBooking(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const result = await bookingService.cancelBooking({
      bookingId: id,
      userId: req.user.id,
      userRole: req.user.role,
      cancellationReason: reason,
    });

    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

async function getMyBookings(req, res, next) {
  try {
    const bookings = await bookingService.getMyBookings(req.user.id);
    res.status(200).json({ data: bookings });
  } catch (error) {
    next(error);
  }
}

async function getBookingById(req, res, next) {
  try {
    const booking = await bookingService.getBookingById(req.params.id, req.user.id, req.user.role);
    res.status(200).json({ data: booking });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  holdBooking,
  confirmBooking,
  cancelBooking,
  getMyBookings,
  getBookingById,
};
