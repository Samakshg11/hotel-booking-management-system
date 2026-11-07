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

const DEMO_PASSWORD = 'Password123!';

async function seed() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotel_management?replicaSet=rs0';
  logger.info({ mongoUri }, 'Connecting to MongoDB for seeding...');
  await mongoose.connect(mongoUri);

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

  logger.info('Creating demo users (Guest, Staff, Admin)...');
  const passwordHash = await User.hashPassword(DEMO_PASSWORD);

  const [guest, staff, admin] = await User.create([
    {
      name: 'Demo Guest',
      email: 'guest@hotel.com',
      passwordHash,
      role: 'guest',
      phone: '+91 98765 43210',
    },
    {
      name: 'Front Desk Staff',
      email: 'staff@hotel.com',
      passwordHash,
      role: 'staff',
      phone: '+91 98765 43211',
    },
    {
      name: 'System Administrator',
      email: 'admin@hotel.com',
      passwordHash,
      role: 'admin',
      phone: '+91 98765 43212',
    },
  ]);

  logger.info('Creating Room Types...');
  // Money stored as integer minor units (paise: 1 INR = 100 paise)
  const [standardRoom, deluxeSuite, penthouse] = await RoomType.create([
    {
      name: 'Standard Deluxe',
      description: 'Comfortable king-sized room with garden views and modern work desk',
      capacity: 2,
      amenities: ['King Bed', 'Free Wi-Fi', 'Air Conditioning', 'Ensuite Bathroom', 'Smart TV'],
      baseRate: 450000, // ₹4,500.00
      isActive: true,
    },
    {
      name: 'Executive Suite',
      description: 'Spacious 1-bedroom suite with private balcony, lounge area and mini-bar',
      capacity: 4,
      amenities: ['2 Queen Beds', 'Balcony', 'Mini Bar', 'Bathtub', 'High-speed Wi-Fi', 'Room Service'],
      baseRate: 850000, // ₹8,500.00
      isActive: true,
    },
    {
      name: 'Presidential Penthouse',
      description: 'Top-floor luxury penthouse with panoramic city views, private jacuzzi, and dedicated butler',
      capacity: 6,
      amenities: ['Master Suite', 'Private Jacuzzi', 'Chef Kitchen', 'Panoramic View', 'Butler Service'],
      baseRate: 2500000, // ₹25,000.00
      isActive: true,
    },
  ]);

  logger.info('Creating physical rooms...');
  await Room.create([
    // Floor 1: Standard Deluxe
    { roomNumber: '101', roomTypeId: standardRoom._id, floor: 1, status: 'available' },
    { roomNumber: '102', roomTypeId: standardRoom._id, floor: 1, status: 'available' },
    { roomNumber: '103', roomTypeId: standardRoom._id, floor: 1, status: 'available' },
    { roomNumber: '104', roomTypeId: standardRoom._id, floor: 1, status: 'maintenance' },

    // Floor 2: Executive Suite
    { roomNumber: '201', roomTypeId: deluxeSuite._id, floor: 2, status: 'available' },
    { roomNumber: '202', roomTypeId: deluxeSuite._id, floor: 2, status: 'available' },
    { roomNumber: '203', roomTypeId: deluxeSuite._id, floor: 2, status: 'available' },

    // Floor 3: Presidential Penthouse
    { roomNumber: '301', roomTypeId: penthouse._id, floor: 3, status: 'available' },
  ]);

  logger.info('Database seeded successfully!');
  logger.info('-----------------------------------------');
  logger.info('Demo Credentials (Password: Password123!):');
  logger.info('  - Guest: guest@hotel.com');
  logger.info('  - Staff: staff@hotel.com');
  logger.info('  - Admin: admin@hotel.com');
  logger.info('-----------------------------------------');

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

