const User = require('../models/User');
const Booking = require('../models/Booking');
const { NotFoundError } = require('../utils/errors');

/**
 * Guest Directory Service (Staff & Admin)
 */

async function listGuests({ search, page = 1, limit = 10 }) {
  const query = { role: 'guest' };

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    query.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  const total = await User.countDocuments(query);
  const guests = await User.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return {
    data: guests,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
  };
}

async function getGuestWithHistory(guestId) {
  const guest = await User.findById(guestId);
  if (!guest) {
    throw new NotFoundError('Guest record not found');
  }

  const bookings = await Booking.find({ guestId: guest._id })
    .populate('roomId', 'roomNumber floor status')
    .populate('roomTypeId', 'name capacity baseRate')
    .sort({ createdAt: -1 });

  return {
    guest: guest.toJSON(),
    bookings,
  };
}

module.exports = {
  listGuests,
  getGuestWithHistory,
};

