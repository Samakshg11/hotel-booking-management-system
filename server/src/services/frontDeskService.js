const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const AuditLog = require('../models/AuditLog');
const { validateBookingTransition } = require('./bookingStateMachine');
const { getTodayUtcString } = require('../utils/dates');
const env = require('../config/env');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const { withTransaction } = require('../utils/transaction');

/**
 * Check-in operation (Staff / Admin only)
 * Booking must be in CONFIRMED status.
 * Today must be >= checkIn date (unless ALLOW_EARLY_CHECKIN=true).
 */
async function checkInGuest({ bookingId, actorId, actorRole }) {
  const booking = await Booking.findById(bookingId).populate('roomId').populate('roomTypeId');
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Validate state machine: CONFIRMED -> CHECKED_IN
  validateBookingTransition(booking.status, 'CHECKED_IN');

  const todayStr = getTodayUtcString();
  if (booking.checkIn > todayStr && !env.ALLOW_EARLY_CHECKIN) {
    throw new BadRequestError(
      `Check-in date is ${booking.checkIn}. Cannot check in prior to arrival date without early check-in permission`,
      null,
      'EARLY_CHECKIN_PROHIBITED'
    );
  }

  const result = await withTransaction(async (session) => {
    const sessionOpts = session ? { session } : {};

    // 1. Transition booking to CHECKED_IN
    booking.status = 'CHECKED_IN';
    await booking.save(sessionOpts);

    // 2. Write audit log
    await AuditLog.create(
      [
        {
          actorId,
          actorRole,
          action: 'BOOKING_CHECK_IN',
          entityType: 'Booking',
          entityId: booking._id.toString(),
          before: { status: 'CONFIRMED' },
          after: { status: 'CHECKED_IN', checkedInAt: new Date() },
          meta: { roomNumber: booking.roomId?.roomNumber },
        },
      ],
      sessionOpts
    );

    return booking;
  });

  return result;
}

/**
 * Check-out operation (Staff / Admin only)
 * Booking must be in CHECKED_IN status.
 */
async function checkOutGuest({ bookingId, actorId, actorRole }) {
  const booking = await Booking.findById(bookingId).populate('roomId').populate('roomTypeId');
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Validate state machine: CHECKED_IN -> CHECKED_OUT
  validateBookingTransition(booking.status, 'CHECKED_OUT');

  const result = await withTransaction(async (session) => {
    const sessionOpts = session ? { session } : {};

    // 1. Transition booking to CHECKED_OUT
    booking.status = 'CHECKED_OUT';
    await booking.save(sessionOpts);

    // 2. Write audit log
    await AuditLog.create(
      [
        {
          actorId,
          actorRole,
          action: 'BOOKING_CHECK_OUT',
          entityType: 'Booking',
          entityId: booking._id.toString(),
          before: { status: 'CHECKED_IN' },
          after: { status: 'CHECKED_OUT', checkedOutAt: new Date() },
          meta: { roomNumber: booking.roomId?.roomNumber },
        },
      ],
      sessionOpts
    );

    return booking;
  });

  return result;
}

/**
 * Staff / Admin: List all bookings with search, filters and pagination
 */
async function listAllBookings({ status, fromDate, toDate, reference, guestEmail, search, page = 1, limit = 10 }) {
  const query = {};

  if (status) query.status = status;

  const searchFilter = search || reference;
  if (searchFilter && searchFilter.trim()) {
    const regex = new RegExp(searchFilter.trim(), 'i');
    query.$or = [
      { reference: regex },
      { 'guestDetails.fullName': regex },
      { 'guestDetails.email': regex },
    ];
  } else if (guestEmail) {
    query['guestDetails.email'] = new RegExp(guestEmail.trim(), 'i');
  }

  if (fromDate && toDate) {
    query.checkIn = { $lte: toDate };
    query.checkOut = { $gte: fromDate };
  } else if (fromDate) {
    query.checkIn = { $gte: fromDate };
  } else if (toDate) {
    query.checkOut = { $lte: toDate };
  }

  const total = await Booking.countDocuments(query);
  const bookings = await Booking.find(query)
    .populate('roomId', 'roomNumber floor status')
    .populate('roomTypeId', 'name capacity baseRate amenities')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return {
    data: bookings,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
  };
}

module.exports = {
  checkInGuest,
  checkOutGuest,
  listAllBookings,
};

