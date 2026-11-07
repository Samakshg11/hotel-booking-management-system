const frontDeskService = require('../services/frontDeskService');

/**
 * Front Desk Operations Controller (Staff & Admin)
 */

async function checkIn(req, res, next) {
  try {
    const booking = await frontDeskService.checkInGuest({
      bookingId: req.params.id,
      actorId: req.user.id,
      actorRole: req.user.role,
    });
    res.status(200).json({ data: booking });
  } catch (error) {
    next(error);
  }
}

async function checkOut(req, res, next) {
  try {
    const booking = await frontDeskService.checkOutGuest({
      bookingId: req.params.id,
      actorId: req.user.id,
      actorRole: req.user.role,
    });
    res.status(200).json({ data: booking });
  } catch (error) {
    next(error);
  }
}

async function listBookings(req, res, next) {
  try {
    const { status, from, to, reference, guestEmail, page, limit } = req.query;
    const result = await frontDeskService.listAllBookings({
      status,
      fromDate: from,
      toDate: to,
      reference,
      guestEmail,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
    res.status(200).json({ data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  checkIn,
  checkOut,
  listBookings,
};

