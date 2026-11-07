const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const RoomType = require('../models/RoomType');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const IdempotencyKey = require('../models/IdempotencyKey');
const RateOverride = require('../models/RateOverride');
const logger = require('../config/logger');
const { generateBookingReference } = require('../utils/reference');
const { getStayNights } = require('../utils/dates');

const DEMO_PASSWORD = 'Password123!';

async function seed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotel_management?replicaSet=rs0';
  logger.info({ mongoUri }, 'Connecting to MongoDB for seeding...');
  await mongoose.connect(mongoUri);

  logger.info('Syncing indexes on all collections...');
  const models = [User, RoomType, Room, RoomNight, Booking, Payment, AuditLog, IdempotencyKey, RateOverride];
  for (const m of models) {
    await m.syncIndexes();
  }

  logger.info('Clearing existing database collections...');
  await Promise.all([
    User.deleteMany({}),
    RoomType.deleteMany({}),
    Room.deleteMany({}),
    RoomNight.deleteMany({}),
    Booking.deleteMany({}),
    Payment.deleteMany({}),
    AuditLog.deleteMany({}),
    IdempotencyKey.deleteMany({}),
    RateOverride.deleteMany({}),
  ]);

  logger.info('Creating demo users (guest@demo.test, staff@demo.test, admin@demo.test)...');
  const passwordHash = await User.hashPassword(DEMO_PASSWORD);

  const [guest, staff, admin] = await User.create([
    {
      name: 'Demo Guest',
      email: 'guest@demo.test',
      passwordHash,
      role: 'guest',
      phone: '+91 98765 43210',
    },
    {
      name: 'Front Desk Staff',
      email: 'staff@demo.test',
      passwordHash,
      role: 'staff',
      phone: '+91 98765 43211',
    },
    {
      name: 'System Administrator',
      email: 'admin@demo.test',
      passwordHash,
      role: 'admin',
      phone: '+91 98765 43212',
    },
    {
      name: 'Demo Guest Alternate',
      email: 'guest@hotel.com',
      passwordHash,
      role: 'guest',
      phone: '+91 98765 43213',
    },
    {
      name: 'Front Desk Staff Alternate',
      email: 'staff@hotel.com',
      passwordHash,
      role: 'staff',
      phone: '+91 98765 43214',
    },
    {
      name: 'System Administrator Alternate',
      email: 'admin@hotel.com',
      passwordHash,
      role: 'admin',
      phone: '+91 98765 43215',
    },
  ]);

  logger.info('Creating 4 Room Types (Standard, Deluxe, Family Suite, Presidential)...');
  // Integer minor units (paise)
  const [standardRoom, deluxeRoom, familySuite, presidential] = await RoomType.create([
    {
      name: 'Standard',
      description: 'Cozy queen-bed room ideal for solo travelers or couples with city view.',
      capacity: 2,
      amenities: ['Queen Bed', 'High-speed Wi-Fi', 'Work Desk', 'Ensuite Shower', 'Smart TV'],
      baseRate: 350000, // ₹3,500.00
      isActive: true,
    },
    {
      name: 'Deluxe',
      description: 'Elegant king-bed room with private balcony, sitting area and premium bath.',
      capacity: 2,
      amenities: ['King Bed', 'Balcony', 'Mini Bar', 'Bathtub', 'High-speed Wi-Fi', 'Room Service'],
      baseRate: 550000, // ₹5,500.00
      isActive: true,
    },
    {
      name: 'Family Suite',
      description: 'Spacious 2-bedroom suite with living room, kitchenette and 2 bathrooms.',
      capacity: 4,
      amenities: ['1 King + 2 Twin Beds', 'Living Room', 'Kitchenette', '2 Bathrooms', 'Dining Table'],
      baseRate: 950000, // ₹9,500.00
      isActive: true,
    },
    {
      name: 'Presidential',
      description: 'Top-tier luxury penthouse suite with panoramic views, jacuzzi and butler service.',
      capacity: 6,
      amenities: ['Master Suite', 'Private Jacuzzi', 'Chef Kitchen', 'Panoramic Terrace', 'Butler Service'],
      baseRate: 2200000, // ₹22,000.00
      isActive: true,
    },
  ]);

  logger.info('Creating ~20 physical rooms across floors...');
  const roomsData = [
    // Floor 1: Standard (101-106)
    { roomNumber: '101', roomTypeId: standardRoom._id, floor: 1, status: 'available' },
    { roomNumber: '102', roomTypeId: standardRoom._id, floor: 1, status: 'available' },
    { roomNumber: '103', roomTypeId: standardRoom._id, floor: 1, status: 'available' },
    { roomNumber: '104', roomTypeId: standardRoom._id, floor: 1, status: 'available' },
    { roomNumber: '105', roomTypeId: standardRoom._id, floor: 1, status: 'available' },
    { roomNumber: '106', roomTypeId: standardRoom._id, floor: 1, status: 'maintenance' },

    // Floor 2: Deluxe (201-206)
    { roomNumber: '201', roomTypeId: deluxeRoom._id, floor: 2, status: 'available' },
    { roomNumber: '202', roomTypeId: deluxeRoom._id, floor: 2, status: 'available' },
    { roomNumber: '203', roomTypeId: deluxeRoom._id, floor: 2, status: 'available' },
    { roomNumber: '204', roomTypeId: deluxeRoom._id, floor: 2, status: 'available' },
    { roomNumber: '205', roomTypeId: deluxeRoom._id, floor: 2, status: 'available' },
    { roomNumber: '206', roomTypeId: deluxeRoom._id, floor: 2, status: 'out_of_service' },

    // Floor 3: Family Suite (301-305)
    { roomNumber: '301', roomTypeId: familySuite._id, floor: 3, status: 'available' },
    { roomNumber: '302', roomTypeId: familySuite._id, floor: 3, status: 'available' },
    { roomNumber: '303', roomTypeId: familySuite._id, floor: 3, status: 'available' },
    { roomNumber: '304', roomTypeId: familySuite._id, floor: 3, status: 'available' },
    { roomNumber: '305', roomTypeId: familySuite._id, floor: 3, status: 'available' },

    // Floor 4: Presidential (401-403)
    { roomNumber: '401', roomTypeId: presidential._id, floor: 4, status: 'available' },
    { roomNumber: '402', roomTypeId: presidential._id, floor: 4, status: 'available' },
    { roomNumber: '403', roomTypeId: presidential._id, floor: 4, status: 'available' },
  ];

  const createdRooms = await Room.create(roomsData);

  logger.info('Creating 10-15 sample bookings across various statuses/dates...');
  const sampleBookingsConfig = [
    {
      roomIndex: 0, // 101 Standard
      type: standardRoom,
      status: 'CONFIRMED',
      checkIn: '2026-11-10',
      checkOut: '2026-11-13',
      nights: 3,
      guests: 2,
    },
    {
      roomIndex: 1, // 102 Standard
      type: standardRoom,
      status: 'CHECKED_IN',
      checkIn: '2026-11-06',
      checkOut: '2026-11-09',
      nights: 3,
      guests: 1,
    },
    {
      roomIndex: 2, // 103 Standard
      type: standardRoom,
      status: 'CHECKED_OUT',
      checkIn: '2026-11-01',
      checkOut: '2026-11-04',
      nights: 3,
      guests: 2,
    },
    {
      roomIndex: 6, // 201 Deluxe
      type: deluxeRoom,
      status: 'CONFIRMED',
      checkIn: '2026-11-15',
      checkOut: '2026-11-18',
      nights: 3,
      guests: 2,
    },
    {
      roomIndex: 7, // 202 Deluxe
      type: deluxeRoom,
      status: 'CANCELLED',
      checkIn: '2026-11-20',
      checkOut: '2026-11-23',
      nights: 3,
      guests: 2,
      cancelledAt: new Date(),
      cancellationReason: 'Change of travel plans',
    },
    {
      roomIndex: 12, // 301 Family Suite
      type: familySuite,
      status: 'CHECKED_IN',
      checkIn: '2026-11-05',
      checkOut: '2026-11-08',
      nights: 3,
      guests: 4,
    },
    {
      roomIndex: 13, // 302 Family Suite
      type: familySuite,
      status: 'CONFIRMED',
      checkIn: '2026-11-25',
      checkOut: '2026-11-28',
      nights: 3,
      guests: 3,
    },
    {
      roomIndex: 17, // 401 Presidential
      type: presidential,
      status: 'CONFIRMED',
      checkIn: '2026-12-01',
      checkOut: '2026-12-05',
      nights: 4,
      guests: 5,
    },
    {
      roomIndex: 3, // 104 Standard
      type: standardRoom,
      status: 'HELD',
      checkIn: '2026-11-12',
      checkOut: '2026-11-14',
      nights: 2,
      guests: 1,
      holdExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
    {
      roomIndex: 8, // 203 Deluxe
      type: deluxeRoom,
      status: 'EXPIRED',
      checkIn: '2026-11-02',
      checkOut: '2026-11-04',
      nights: 2,
      guests: 2,
      holdExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
    {
      roomIndex: 14, // 303 Family Suite
      type: familySuite,
      status: 'CONFIRMED',
      checkIn: '2026-12-10',
      checkOut: '2026-12-14',
      nights: 4,
      guests: 4,
    },
  ];

  for (const bkg of sampleBookingsConfig) {
    const room = createdRooms[bkg.roomIndex];
    const subtotal = bkg.type.baseRate * bkg.nights;
    const tax = Math.round(subtotal * 0.12);
    const total = subtotal + tax;
    const stayNights = getStayNights(bkg.checkIn, bkg.checkOut);

    const booking = await Booking.create({
      reference: generateBookingReference(),
      guestId: guest._id,
      roomId: room._id,
      roomTypeId: bkg.type._id,
      checkIn: bkg.checkIn,
      checkOut: bkg.checkOut,
      nights: bkg.nights,
      guests: bkg.guests,
      status: bkg.status,
      guestDetails: {
        fullName: 'Demo Guest',
        email: 'guest@demo.test',
        phone: '+91 98765 43210',
      },
      price: {
        nightly: stayNights.map((d) => ({ date: d, rate: bkg.type.baseRate })),
        subtotal,
        taxRate: 0.12,
        tax,
        fees: 0,
        total,
      },
      holdExpiresAt: bkg.holdExpiresAt || null,
      cancelledAt: bkg.cancelledAt || null,
      cancellationReason: bkg.cancellationReason || null,
    });

    // If active occupied booking (CONFIRMED or CHECKED_IN or active HELD), insert roomNights
    if (['CONFIRMED', 'CHECKED_IN'].includes(bkg.status)) {
      const nightDocs = stayNights.map((date) => ({
        roomId: room._id,
        date,
        bookingId: booking._id,
        status: 'CONFIRMED',
      }));
      await RoomNight.insertMany(nightDocs);

      // Create simulated payment
      await Payment.create({
        bookingId: booking._id,
        amount: total,
        status: 'SUCCEEDED',
        method: 'SANDBOX',
        providerRef: `PAY-${booking.reference}-${Date.now()}`,
      });
    } else if (bkg.status === 'HELD' && bkg.holdExpiresAt > new Date()) {
      const nightDocs = stayNights.map((date) => ({
        roomId: room._id,
        date,
        bookingId: booking._id,
        status: 'HELD',
        expiresAt: bkg.holdExpiresAt,
      }));
      await RoomNight.insertMany(nightDocs);
    }
  }

  logger.info('Sample bookings created successfully!');
  logger.info('========================================================');
  logger.info('DEMO ACCOUNTS READY (Password for all: Password123!)');
  logger.info('  1. Guest: guest@demo.test');
  logger.info('  2. Staff: staff@demo.test');
  logger.info('  3. Admin: admin@demo.test');
  logger.info('========================================================');

  await mongoose.disconnect();
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}

module.exports = seed;
