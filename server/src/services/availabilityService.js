const RoomType = require('../models/RoomType');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const { pricingService } = require('./pricingService');
const { calculateStayPricing } = require('./pricingService');
const {
  isValidDateString,
  getTodayUtcString,
  parseUtcDate,
  calculateNights,
  getStayNights,
} = require('../utils/dates');
const { BadRequestError } = require('../utils/errors');

/**
 * Validates check-in, check-out dates and guest count per Section 6 business rules
 */
function validateBookingDates(checkIn, checkOut, guests = 1) {
  if (!isValidDateString(checkIn)) {
    throw new BadRequestError('Invalid checkIn date format. Must be YYYY-MM-DD');
  }
  if (!isValidDateString(checkOut)) {
    throw new BadRequestError('Invalid checkOut date format. Must be YYYY-MM-DD');
  }

  const todayStr = getTodayUtcString();
  if (checkIn < todayStr) {
    throw new BadRequestError(`checkIn date must be today (${todayStr}) or later`);
  }

  const nights = calculateNights(checkIn, checkOut);
  if (nights <= 0) {
    throw new BadRequestError('checkOut date must be strictly after checkIn date');
  }

  if (nights > 30) {
    throw new BadRequestError('Maximum stay duration cannot exceed 30 nights');
  }

  if (!guests || guests < 1) {
    throw new BadRequestError('guests count must be at least 1');
  }

  return { nights };
}

/**
 * Finds available rooms for a given room type across the stay dates
 * A room is available if room.status == 'available' AND no roomNights doc exists
 * in [checkIn, checkOut), ignoring HELD docs whose expiresAt < now.
 */
async function findAvailableRoomsForType(roomTypeId, checkIn, checkOut, session = null) {
  const stayNights = getStayNights(checkIn, checkOut);
  const now = new Date();

  // 1. Find all active physical rooms of this type with status 'available'
  const candidateRooms = await Room.find({
    roomTypeId,
    status: 'available',
  })
    .sort({ roomNumber: 1 })
    .session(session)
    .lean();

  if (candidateRooms.length === 0) {
    return [];
  }

  const candidateRoomIds = candidateRooms.map((r) => r._id);

  // 2. Find all conflicting occupied roomNights in this date range
  // Ignore HELD docs whose expiresAt < now
  const conflictingNights = await RoomNight.find({
    roomId: { $in: candidateRoomIds },
    date: { $in: stayNights },
    $or: [
      { status: 'CONFIRMED' },
      { status: 'HELD', expiresAt: { $gt: now } },
    ],
  })
    .session(session)
    .lean();

  const occupiedRoomIdStrings = new Set(conflictingNights.map((n) => n.roomId.toString()));

  // 3. Filter down candidate rooms that have zero conflicting nights
  return candidateRooms.filter((r) => !occupiedRoomIdStrings.has(r._id.toString()));
}

/**
 * Searches room types with live availability count and itemized pricing breakdown
 */
async function searchAvailability({ checkIn, checkOut, guests = 1, roomTypeId = null, page = 1, limit = 10 }) {
  validateBookingDates(checkIn, checkOut, guests);

  const query = { isActive: true, capacity: { $gte: Number(guests) } };
  if (roomTypeId) {
    query._id = roomTypeId;
  }

  const totalTypes = await RoomType.countDocuments(query);
  const roomTypes = await RoomType.find(query)
    .sort({ baseRate: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const results = [];

  for (const rt of roomTypes) {
    const availableRooms = await findAvailableRoomsForType(rt._id, checkIn, checkOut);
    const pricing = await calculateStayPricing(rt, checkIn, checkOut);

    results.push({
      roomType: {
        id: rt._id,
        name: rt.name,
        description: rt.description,
        capacity: rt.capacity,
        amenities: rt.amenities,
        baseRate: rt.baseRate,
      },
      availableCount: availableRooms.length,
      isAvailable: availableRooms.length > 0,
      pricing: {
        nightly: pricing.nightly,
        subtotal: pricing.subtotal,
        taxRate: pricing.taxRate,
        tax: pricing.tax,
        fees: pricing.fees,
        total: pricing.total,
        averageNightlyRate: Math.round(pricing.subtotal / pricing.nightly.length),
      },
    });
  }

  return {
    data: results,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total: totalTypes,
    },
  };
}

module.exports = {
  validateBookingDates,
  findAvailableRoomsForType,
  searchAvailability,
};
