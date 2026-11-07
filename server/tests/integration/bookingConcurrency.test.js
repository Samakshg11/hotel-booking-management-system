const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const RoomType = require('../../src/models/RoomType');
const Room = require('../../src/models/Room');
const RoomNight = require('../../src/models/RoomNight');
const Booking = require('../../src/models/Booking');
const { getTodayUtcString } = require('../../src/utils/dates');

describe('The Unique-Index Trick & Booking Hold Concurrency Tests', () => {
  let guestToken;
  let guest2Token;
  let roomType;

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123!');
    const [guest1, guest2] = await User.create([
      { name: 'Guest One', email: 'guest1@demo.test', passwordHash, role: 'guest' },
      { name: 'Guest Two', email: 'guest2@demo.test', passwordHash, role: 'guest' },
    ]);

    const res1 = await request(app).post('/api/v1/auth/login').send({ email: 'guest1@demo.test', password: 'Password123!' });
    const res2 = await request(app).post('/api/v1/auth/login').send({ email: 'guest2@demo.test', password: 'Password123!' });
    guestToken = res1.body.data.token;
    guest2Token = res2.body.data.token;

    roomType = await RoomType.create({
      name: 'Deluxe Twin',
      capacity: 2,
      baseRate: 500000,
    });

    // Create exactly TWO physical rooms for this room type
    await Room.create([
      { roomNumber: '201', roomTypeId: roomType._id, floor: 2, status: 'available' },
      { roomNumber: '202', roomTypeId: roomType._id, floor: 2, status: 'available' },
    ]);
  });

  it('should successfully create a hold with reference, prices, and roomNight records', async () => {
    const today = getTodayUtcString();
    const checkIn = today;
    const checkOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const res = await request(app)
      .post('/api/v1/bookings/hold')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        roomTypeId: roomType._id.toString(),
        checkIn,
        checkOut,
        guests: 2,
        guestDetails: {
          fullName: 'Guest One',
          email: 'guest1@demo.test',
          phone: '+91 98765 00001',
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('reference');
    expect(res.body.data.reference).toMatch(/^HB-\d{8}-[0-9A-Z]{5}$/);
    expect(res.body.data.status).toBe('HELD');
    expect(res.body.data.price.total).toBe(1120000); // 2 nights * 500000 + 12% tax

    // Verify roomNights inserted with compound unique index
    const nights = await RoomNight.find({ bookingId: res.body.data._id });
    expect(nights.length).toBe(2);
    expect(nights[0].status).toBe('HELD');
  });

  it('should prevent double-booking under concurrent hold attempts and assign distinct candidate rooms', async () => {
    const today = getTodayUtcString();
    const checkIn = today;
    const checkOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Two users simultaneously requesting hold for the same room type and dates
    const [hold1, hold2] = await Promise.all([
      request(app)
        .post('/api/v1/bookings/hold')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          roomTypeId: roomType._id.toString(),
          checkIn,
          checkOut,
          guests: 2,
        }),
      request(app)
        .post('/api/v1/bookings/hold')
        .set('Authorization', `Bearer ${guest2Token}`)
        .send({
          roomTypeId: roomType._id.toString(),
          checkIn,
          checkOut,
          guests: 2,
        }),
    ]);

    expect(hold1.status).toBe(201);
    expect(hold2.status).toBe(201);
    // Both succeeded by claiming distinct rooms (201 and 202)
    expect(hold1.body.data.roomId).not.toBe(hold2.body.data.roomId);

    // Third request: Both rooms are now locked; should fail with 409 NO_AVAILABILITY
    const hold3 = await request(app)
      .post('/api/v1/bookings/hold')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        roomTypeId: roomType._id.toString(),
        checkIn,
        checkOut,
        guests: 2,
      });

    expect(hold3.status).toBe(409);
    expect(hold3.body.error).toHaveProperty('code', 'NO_AVAILABILITY');
  });

  it('should allow same-day turnover (check-out date is NOT an occupied night)', async () => {
    // Guest 1 books days 10 to 12
    const res1 = await request(app)
      .post('/api/v1/bookings/hold')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        roomTypeId: roomType._id.toString(),
        checkIn: '2026-11-10',
        checkOut: '2026-11-12',
        guests: 1,
      });
    expect(res1.status).toBe(201);

    // Guest 2 books days 12 to 14 (starts on checkOut date of Guest 1)
    const res2 = await request(app)
      .post('/api/v1/bookings/hold')
      .set('Authorization', `Bearer ${guest2Token}`)
      .send({
        roomTypeId: roomType._id.toString(),
        checkIn: '2026-11-12',
        checkOut: '2026-11-14',
        guests: 1,
      });
    expect(res2.status).toBe(201);
  });

  it('should ignore expired holds and allow rebooking the room', async () => {
    // Manually create an expired HELD night in DB
    const room = await Room.findOne({ roomNumber: '201' });
    const expiredBooking = await Booking.create({
      reference: 'HB-20261101-EXP01',
      guestId: new (require('mongoose').Types.ObjectId)(),
      roomId: room._id,
      roomTypeId: roomType._id,
      checkIn: '2026-11-10',
      checkOut: '2026-11-12',
      nights: 2,
      guests: 1,
      status: 'HELD',
      guestDetails: { fullName: 'Old', email: 'old@demo.test' },
      price: { nightly: [], subtotal: 1000, taxRate: 0.12, tax: 120, fees: 0, total: 1120 },
      holdExpiresAt: new Date(Date.now() - 10 * 60 * 1000), // Expired 10 mins ago
    });

    await RoomNight.create([
      {
        roomId: room._id,
        date: '2026-11-10',
        bookingId: expiredBooking._id,
        status: 'HELD',
        expiresAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    ]);

    // Now a new guest tries to hold 2026-11-10 -> expired hold should be cleaned up and succeed
    const res = await request(app)
      .post('/api/v1/bookings/hold')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        roomTypeId: roomType._id.toString(),
        checkIn: '2026-11-10',
        checkOut: '2026-11-11',
        guests: 1,
      });

    expect(res.status).toBe(201);
  });

  it('should reject MongoDB operator injection attacks with 400 PROHIBITED_CHARACTERS', async () => {
    const res = await request(app)
      .post('/api/v1/bookings/hold')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        '$where': 'sleep(1000)',
        roomTypeId: roomType._id.toString(),
        checkIn: '2026-11-10',
        checkOut: '2026-11-11',
        guests: 1,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toHaveProperty('code', 'PROHIBITED_CHARACTERS');
  });
});
