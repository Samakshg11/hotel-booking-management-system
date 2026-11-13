const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const RoomNight = require('../models/RoomNight');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const { validateBookingTransition } = require('./bookingStateMachine');
const { processSimulatedPayment } = require('./paymentService');
const {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  GoneError,
  BadRequestError,
} = require('../utils/errors');
const { parseUtcDate } = require('../utils/dates');
const { withTransaction } = require('../utils/transaction');
const logger = require('../config/logger');

/**
 * Checks caller ownership of booking
 */
function verifyBookingOwnership(booking, userId, userRole) {
  if (['staff', 'admin'].includes(userRole)) {
    return true;
  }
  // After .populate('guestId'), guestId may be an object with _id, not a raw ObjectId
  const bookingGuestId = booking.guestId?._id
    ? booking.guestId._id.toString()
    : booking.guestId.toString();
  if (bookingGuestId !== userId) {
    throw new ForbiddenError('You do not have permission to access this booking');
  }
  return true;
}

/**
 * Confirm Booking (POST /bookings/:id/confirm)
 * Enforces ownership, hold expiry, state machine, deterministic payment simulation,
 * and multi-document transaction committing room nights, booking status, payment and audit log.
 */
async function confirmBooking({ bookingId, userId, userRole, paymentDetails, idempotencyKey = null }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // 1. Ownership check
  verifyBookingOwnership(booking, userId, userRole);

  const now = new Date();

  // 2. Check hold expiration
  if (booking.status === 'HELD' && booking.holdExpiresAt && booking.holdExpiresAt < now) {
    // Hold has expired: mark booking EXPIRED and release room nights
    await withTransaction(async (session) => {
      const sessionOpts = session ? { session } : {};
      await RoomNight.deleteMany({ bookingId: booking._id }, sessionOpts);
      booking.status = 'EXPIRED';
      await booking.save(sessionOpts);
      await AuditLog.create(
        [
          {
            actorId: userId,
            actorRole: userRole,
            action: 'BOOKING_EXPIRE',
            entityType: 'Booking',
            entityId: booking._id.toString(),
            before: { status: 'HELD' },
            after: { status: 'EXPIRED' },
            meta: { reason: 'Hold timer expired prior to payment' },
          },
        ],
        sessionOpts
      );
    });

    throw new GoneError('Hold has expired. Please search again and create a new reservation', 'HOLD_EXPIRED');
  }

  // 3. Status must be HELD
  if (booking.status !== 'HELD') {
    throw new ConflictError(
      `Cannot confirm booking in status '${booking.status}'. Booking must be in 'HELD' status`,
      'INVALID_STATE'
    );
  }

  // 4. Validate transition via State Machine
  validateBookingTransition(booking.status, 'CONFIRMED');

  // 5. Simulate payment (SANDBOX)
  const paymentResult = await processSimulatedPayment({
    bookingReference: booking.reference,
    amount: booking.price.total,
    cardNumber: paymentDetails?.cardNumber,
  });

  // 6. Execute atomic transaction to confirm booking, update nights, record payment and audit log
  const result = await withTransaction(async (session) => {
    const sessionOpts = session ? { session } : {};

    // Step A: Set room nights to CONFIRMED (unset expiresAt)
    await RoomNight.updateMany(
      { bookingId: booking._id },
      {
        $set: { status: 'CONFIRMED' },
        $unset: { expiresAt: 1 },
      },
      sessionOpts
    );

    // Step B: Set booking to CONFIRMED
    booking.status = 'CONFIRMED';
    if (idempotencyKey) {
      booking.idempotencyKey = idempotencyKey;
    }
    await booking.save(sessionOpts);

    // Step C: Create Payment record
    const [payment] = await Payment.create(
      [
        {
          bookingId: booking._id,
          amount: booking.price.total,
          status: 'SUCCEEDED',
          method: 'SANDBOX',
          providerRef: paymentResult.providerRef,
        },
      ],
      sessionOpts
    );

    // Step D: Write audit log
    await AuditLog.create(
      [
        {
          actorId: userId,
          actorRole: userRole,
          action: 'BOOKING_CONFIRM',
          entityType: 'Booking',
          entityId: booking._id.toString(),
          before: { status: 'HELD' },
          after: {
            status: 'CONFIRMED',
            paymentId: payment._id,
            providerRef: paymentResult.providerRef,
            amount: booking.price.total,
          },
          meta: { idempotencyKey },
        },
      ],
      sessionOpts
    );

    return {
      booking,
      payment,
    };
  });

  logger.info({ bookingId: booking._id, reference: booking.reference }, 'Booking confirmed successfully');
  return result;
}

/**
 * Cancel Booking (POST /bookings/:id/cancel)
 * Enforces ownership, state machine, deletes roomNights, and calculates simulated refund.
 */
async function cancelBooking({ bookingId, userId, userRole, cancellationReason }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  // Ownership check
  verifyBookingOwnership(booking, userId, userRole);

  // Validate state machine transition (allowed from HELD or CONFIRMED)
  validateBookingTransition(booking.status, 'CANCELLED');

  const priorStatus = booking.status;
  const now = new Date();

  const result = await withTransaction(async (session) => {
    const sessionOpts = session ? { session } : {};

    // 1. Delete all room nights so room is immediately available again
    await RoomNight.deleteMany({ bookingId: booking._id }, sessionOpts);

    let refundDetails = null;

    // 2. If booking was CONFIRMED, calculate refund policy
    if (priorStatus === 'CONFIRMED') {
      const checkInDate = parseUtcDate(booking.checkIn);
      const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      const existingPayment = await Payment.findOne({
        bookingId: booking._id,
        status: 'SUCCEEDED',
      }).session(session);

      if (existingPayment) {
        if (hoursUntilCheckIn > 24) {
          // Full refund
          existingPayment.status = 'REFUNDED';
          await existingPayment.save(sessionOpts);
          refundDetails = {
            refundAmount: existingPayment.amount,
            retainedAmount: 0,
            policy: 'FULL_REFUND_GREATER_THAN_24H',
          };
        } else {
          // Retain first night rate; refund remainder
          const firstNightRate = booking.price.nightly[0]?.rate || 0;
          const refundAmount = Math.max(0, existingPayment.amount - firstNightRate);
          existingPayment.status = 'PARTIALLY_REFUNDED';
          await existingPayment.save(sessionOpts);
          refundDetails = {
            refundAmount,
            retainedAmount: firstNightRate,
            policy: 'PARTIAL_REFUND_WITHIN_24H_FIRST_NIGHT_RETAINED',
          };
        }
      }
    }

    // 3. Update booking record
    booking.status = 'CANCELLED';
    booking.cancelledAt = now;
    booking.cancellationReason = cancellationReason || 'Cancelled by guest/staff';
    await booking.save(sessionOpts);

    // 4. Record audit log
    await AuditLog.create(
      [
        {
          actorId: userId,
          actorRole: userRole,
          action: 'BOOKING_CANCEL',
          entityType: 'Booking',
          entityId: booking._id.toString(),
          before: { status: priorStatus },
          after: { status: 'CANCELLED', cancelledAt: now, refundDetails },
          meta: { reason: booking.cancellationReason },
        },
      ],
      sessionOpts
    );

    return {
      booking,
      refund: refundDetails,
    };
  });

  logger.info({ bookingId: booking._id, reference: booking.reference }, 'Booking cancelled successfully');
  return result;
}

/**
 * Guest: View own bookings history
 */
async function getMyBookings(guestId) {
  return Booking.find({ guestId })
    .populate('roomId', 'roomNumber floor status')
    .populate('roomTypeId', 'name capacity baseRate amenities')
    .sort({ createdAt: -1 });
}

/**
 * Get single booking by ID with ownership enforcement
 */
async function getBookingById(bookingId, userId, userRole) {
  const booking = await Booking.findById(bookingId)
    .populate('roomId', 'roomNumber floor status')
    .populate('roomTypeId', 'name capacity baseRate amenities')
    .populate('guestId', 'name email phone');

  if (!booking) {
    throw new NotFoundError('Booking not found');
  }

  verifyBookingOwnership(booking, userId, userRole);
  return booking;
}

module.exports = {
  verifyBookingOwnership,
  confirmBooking,
  cancelBooking,
  getMyBookings,
  getBookingById,
};

