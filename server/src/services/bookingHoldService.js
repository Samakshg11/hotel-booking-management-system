const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const RoomNight = require('../models/RoomNight');
const RoomType = require('../models/RoomType');
const AuditLog = require('../models/AuditLog');
const env = require('../config/env');
const { getStayNights } = require('../utils/dates');
const { generateBookingReference } = require('../utils/reference');
const { validateBookingDates, findAvailableRoomsForType } = require('./availabilityService');
const { calculateStayPricing } = require('./pricingService');
const { ConflictError, NotFoundError, BadRequestError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * Creates a hold reservation inside a MongoDB transaction with the Unique-Index pattern.
 * Tries candidate rooms sequentially; if a concurrency collision occurs (code 11000),
 * falls back to the next room. If none remain, throws 409 NO_AVAILABILITY.
 */
async function holdBooking({ guestId, roomTypeId, checkIn, checkOut, guests, guestDetails, actorRole = 'guest' }) {
  // 1. Validate dates and parameters
  const { nights } = validateBookingDates(checkIn, checkOut, guests);

  const roomType = await RoomType.findById(roomTypeId).lean();
  if (!roomType || !roomType.isActive) {
    throw new NotFoundError('Room type not found or inactive');
  }

  if (guests > roomType.capacity) {
    throw new BadRequestError(`Guest count exceeds maximum capacity of ${roomType.capacity}`);
  }

  // 2. Load candidate available rooms of the requested type ordered by room number
  const candidateRooms = await findAvailableRoomsForType(roomTypeId, checkIn, checkOut);
  if (candidateRooms.length === 0) {
    throw new ConflictError('No rooms available for the selected dates and room type', 'NO_AVAILABILITY');
  }

  const stayNights = getStayNights(checkIn, checkOut);
  const price = await calculateStayPricing(roomType, checkIn, checkOut);
  const now = new Date();
  const holdExpiresAt = new Date(now.getTime() + env.HOLD_MINUTES * 60 * 1000);

  // 3. Iterate through candidate rooms, attempting transaction insertion
  for (const candidateRoom of candidateRooms) {
    const session = await mongoose.startSession();
    try {
      let createdBooking = null;

      await session.withTransaction(async () => {
        // Step A: For the chosen room, delete expired HELD roomNights in the range
        await RoomNight.deleteMany(
          {
            roomId: candidateRoom._id,
            date: { $in: stayNights },
            status: 'HELD',
            expiresAt: { $lt: now },
          },
          { session }
        );

        // Pre-generate booking ObjectId so roomNights can link directly
        const bookingId = new mongoose.Types.ObjectId();
        const reference = generateBookingReference();

        // Step B: insertMany one roomNights doc per night with status HELD
        const roomNightDocs = stayNights.map((date) => ({
          roomId: candidateRoom._id,
          date,
          bookingId,
          status: 'HELD',
          expiresAt: holdExpiresAt,
        }));

        // The Unique Index Trick: Throws code 11000 if another concurrent request reserved any night
        await RoomNight.insertMany(roomNightDocs, { session });

        // Step C: Create booking with status HELD, price breakdown, reference
        const [booking] = await Booking.create(
          [
            {
              _id: bookingId,
              reference,
              guestId,
              roomId: candidateRoom._id,
              roomTypeId: roomType._id,
              checkIn,
              checkOut,
              nights,
              guests,
              status: 'HELD',
              guestDetails: {
                fullName: guestDetails.fullName,
                email: guestDetails.email.toLowerCase(),
                phone: guestDetails.phone || '',
              },
              price,
              holdExpiresAt,
            },
          ],
          { session }
        );

        // Step D: Write audit log in the same transaction
        await AuditLog.create(
          [
            {
              actorId: guestId,
              actorRole,
              action: 'BOOKING_HOLD',
              entityType: 'Booking',
              entityId: booking._id.toString(),
              before: null,
              after: {
                status: 'HELD',
                reference,
                roomId: candidateRoom._id,
                total: price.total,
              },
              meta: {
                checkIn,
                checkOut,
                nights,
                guests,
              },
            },
          ],
          { session }
        );

        createdBooking = booking;
      });

      await session.endSession();
      logger.info(
        { bookingId: createdBooking._id, reference: createdBooking.reference, roomNumber: candidateRoom.roomNumber },
        'Booking hold created successfully'
      );
      return createdBooking;
    } catch (err) {
      await session.endSession();

      const isDuplicateKey =
        err.code === 11000 ||
        (err.writeErrors && err.writeErrors.some((e) => e.code === 11000));

      if (isDuplicateKey) {
        logger.warn(
          { roomId: candidateRoom._id, roomNumber: candidateRoom.roomNumber },
          'Concurrency collision on room night unique index; falling back to next candidate room'
        );
        continue; // Fallback to next available candidate room
      }

      // If it is another unhandled error, rethrow
      throw err;
    }
  }

  // All candidate rooms were claimed concurrently
  throw new ConflictError('No rooms available for the selected dates and room type', 'NO_AVAILABILITY');
}

module.exports = {
  holdBooking,
};

