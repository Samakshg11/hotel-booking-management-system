const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const RoomType = require('../../src/models/RoomType');
const Room = require('../../src/models/Room');
const RoomNight = require('../../src/models/RoomNight');
const Booking = require('../../src/models/Booking');
const Payment = require('../../src/models/Payment');
const AuditLog = require('../../src/models/AuditLog');
const { getTodayUtcString } = require('../../src/utils/dates');

describe('Booking State Machine, Idempotent Payments & Cancellations Tests', () => {
  let guestToken;
  let guest2Token;
  let staffToken;
  let roomType;
  let room;

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123!');
    const [guest1, guest2, staff] = await User.create([
      { name: 'Guest One', email: 'guest1@demo.test', passwordHash, role: 'guest' },
      { name: 'Guest Two', email: 'guest2@demo.test', passwordHash, role: 'guest' },
      { name: 'Staff Member', email: 'staff@demo.test', passwordHash, role: 'staff' },
    ]);

    const res1 = await request(app).post('/api/v1/auth/login').send({ email: 'guest1@demo.test', password: 'Password123!' });
    const res2 = await request(app).post('/api/v1/auth/login').send({ email: 'guest2@demo.test', password: 'Password123!' });
    const res3 = await request(app).post('/api/v1/auth/login').send({ email: 'staff@demo.test', password: 'Password123!' });

    guestToken = res1.body.data.token;
    guest2Token = res2.body.data.token;
    staffToken = res3.body.data.token;

    roomType = await RoomType.create({
      name: 'Executive Deluxe',
      capacity: 2,
      baseRate: 600000, // ₹6,000.00
    });

    room = await Room.create({
      roomNumber: '301',
      roomTypeId: roomType._id,
      floor: 3,
      status: 'available',
    });
  });

  async function createTestHold(token = guestToken, checkIn = '2026-11-20', checkOut = '2026-11-23') {
    const res = await request(app)
      .post('/api/v1/bookings/hold')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomTypeId: roomType._id.toString(),
        checkIn,
        checkOut,
        guests: 2,
      });
    return res.body.data;
  }

  describe('Confirm Booking & Deterministic Payments', () => {
    it('should confirm a held booking, persist payment and unset expiresAt on roomNights', async () => {
      const hold = await createTestHold();

      const res = await request(app)
        .post(`/api/v1/bookings/${hold._id}/confirm`)
        .set('Authorization', `Bearer ${guestToken}`)
        .set('Idempotency-Key', 'test-key-confirm-1')
        .send({ cardNumber: '4111222233334444' });

      expect(res.status).toBe(200);
      expect(res.body.data.booking.status).toBe('CONFIRMED');
      expect(res.body.data.payment.status).toBe('SUCCEEDED');
      expect(res.body.data.payment.providerRef).toMatch(/^SANDBOX-TX-/);

      // Verify room nights are now CONFIRMED with no expiresAt
      const nights = await RoomNight.find({ bookingId: hold._id });
      expect(nights.length).toBe(3);
      nights.forEach((n) => {
        expect(n.status).toBe('CONFIRMED');
        expect(n.expiresAt).toBeFalsy();
      });

      // Verify Audit log was written
      const audit = await AuditLog.findOne({ entityId: hold._id.toString(), action: 'BOOKING_CONFIRM' });
      expect(audit).not.toBeNull();
    });

    it('should decline payment for card ending in 0000, leaving booking in HELD status', async () => {
      const hold = await createTestHold();

      const res = await request(app)
        .post(`/api/v1/bookings/${hold._id}/confirm`)
        .set('Authorization', `Bearer ${guestToken}`)
        .set('Idempotency-Key', 'test-key-declined')
        .send({ cardNumber: '4111000000000000' });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'PAYMENT_DECLINED');

      // Booking must remain in HELD status
      const currentBooking = await Booking.findById(hold._id);
      expect(currentBooking.status).toBe('HELD');

      // Room nights must remain HELD
      const nights = await RoomNight.find({ bookingId: hold._id });
      nights.forEach((n) => {
        expect(n.status).toBe('HELD');
      });
    });

    it('should reject confirming an expired hold with 410 HOLD_EXPIRED and release room nights', async () => {
      const hold = await createTestHold();

      // Simulate expired hold by updating holdExpiresAt in DB
      await Booking.findByIdAndUpdate(hold._id, { holdExpiresAt: new Date(Date.now() - 5000) });

      const res = await request(app)
        .post(`/api/v1/bookings/${hold._id}/confirm`)
        .set('Authorization', `Bearer ${guestToken}`)
        .set('Idempotency-Key', 'test-key-expired')
        .send({ cardNumber: '4111222233334444' });

      expect(res.status).toBe(410);
      expect(res.body.error).toHaveProperty('code', 'HOLD_EXPIRED');

      // Booking status updated to EXPIRED
      const updated = await Booking.findById(hold._id);
      expect(updated.status).toBe('EXPIRED');

      // Room nights should be released
      const remainingNights = await RoomNight.find({ bookingId: hold._id });
      expect(remainingNights.length).toBe(0);
    });
  });

  describe('Idempotency Key Verification', () => {
    it('should return identical cached response on duplicate request and reject modified payload with 422', async () => {
      const hold = await createTestHold();
      const idempotencyKey = 'unique-idemp-key-xyz';

      // 1. Initial request
      const res1 = await request(app)
        .post(`/api/v1/bookings/${hold._id}/confirm`)
        .set('Authorization', `Bearer ${guestToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ cardNumber: '4111222233331111' });

      expect(res1.status).toBe(200);
      const paymentRef1 = res1.body.data.payment.providerRef;

      // 2. Exact retry with same idempotency key and same payload
      const res2 = await request(app)
        .post(`/api/v1/bookings/${hold._id}/confirm`)
        .set('Authorization', `Bearer ${guestToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ cardNumber: '4111222233331111' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.payment.providerRef).toBe(paymentRef1);

      // Verify no duplicate payments were created in database
      const paymentCount = await Payment.countDocuments({ bookingId: hold._id });
      expect(paymentCount).toBe(1);

      // 3. Retry with same key but different payload -> 422 IDEMPOTENCY_KEY_REUSED
      const res3 = await request(app)
        .post(`/api/v1/bookings/${hold._id}/confirm`)
        .set('Authorization', `Bearer ${guestToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({ cardNumber: '4222333344445555' });

      expect(res3.status).toBe(422);
      expect(res3.body.error).toHaveProperty('code', 'IDEMPOTENCY_KEY_REUSED');
    });
  });

  describe('Cancellation & Refund Policy', () => {
    it('should cancel HELD booking, delete room nights and make room rebookable', async () => {
      const hold = await createTestHold();

      const res = await request(app)
        .post(`/api/v1/bookings/${hold._id}/cancel`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ reason: 'Found alternative hotel' });

      expect(res.status).toBe(200);
      expect(res.body.data.booking.status).toBe('CANCELLED');

      // Room nights must be removed
      const nights = await RoomNight.find({ bookingId: hold._id });
      expect(nights.length).toBe(0);

      // Now another guest can book the exact same dates immediately
      const newHold = await createTestHold(guest2Token);
      expect(newHold).toHaveProperty('reference');
    });

    it('should give full refund when cancelling CONFIRMED booking more than 24h before check-in', async () => {
      // Future date > 24h
      const hold = await createTestHold(guestToken, '2026-11-25', '2026-11-28');
      await request(app)
        .post(`/api/v1/bookings/${hold._id}/confirm`)
        .set('Authorization', `Bearer ${guestToken}`)
        .set('Idempotency-Key', 'future-confirm-key')
        .send({ cardNumber: '4111222233334444' });

      const res = await request(app)
        .post(`/api/v1/bookings/${hold._id}/cancel`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ reason: 'Trip rescheduled' });

      expect(res.status).toBe(200);
      expect(res.body.data.booking.status).toBe('CANCELLED');
      expect(res.body.data.refund.policy).toBe('FULL_REFUND_GREATER_THAN_24H');

      const payment = await Payment.findOne({ bookingId: hold._id });
      expect(payment.status).toBe('REFUNDED');
    });

    it('should retain first night when cancelling CONFIRMED booking within 24h of check-in', async () => {
      // Stay starting today
      const today = getTodayUtcString();
      const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const hold = await createTestHold(guestToken, today, tomorrow);

      await request(app)
        .post(`/api/v1/bookings/${hold._id}/confirm`)
        .set('Authorization', `Bearer ${guestToken}`)
        .set('Idempotency-Key', 'urgent-confirm-key')
        .send({ cardNumber: '4111222233334444' });

      const res = await request(app)
        .post(`/api/v1/bookings/${hold._id}/cancel`)
        .set('Authorization', `Bearer ${guestToken}`)
        .send({ reason: 'Last minute illness' });

      expect(res.status).toBe(200);
      expect(res.body.data.refund.policy).toBe('PARTIAL_REFUND_WITHIN_24H_FIRST_NIGHT_RETAINED');
      expect(res.body.data.refund.retainedAmount).toBe(600000); // 1 night base rate

      const payment = await Payment.findOne({ bookingId: hold._id });
      expect(payment.status).toBe('PARTIALLY_REFUNDED');
    });
  });

  describe('Authorization & Ownership Guards', () => {
    it('should prevent Guest B from confirming or reading Guest A booking', async () => {
      const hold = await createTestHold(guestToken);

      // Guest B tries to view
      const viewRes = await request(app)
        .get(`/api/v1/bookings/${hold._id}`)
        .set('Authorization', `Bearer ${guest2Token}`);
      expect(viewRes.status).toBe(403);
      expect(viewRes.body.error).toHaveProperty('code', 'FORBIDDEN');

      // Guest B tries to confirm
      const confirmRes = await request(app)
        .post(`/api/v1/bookings/${hold._id}/confirm`)
        .set('Authorization', `Bearer ${guest2Token}`)
        .set('Idempotency-Key', 'hijack-attempt-key')
        .send({ cardNumber: '4111222233334444' });
      expect(confirmRes.status).toBe(403);

      // Staff can view
      const staffRes = await request(app)
        .get(`/api/v1/bookings/${hold._id}`)
        .set('Authorization', `Bearer ${staffToken}`);
      expect(staffRes.status).toBe(200);
    });

    it('should list only own bookings in GET /api/v1/bookings/mine', async () => {
      await createTestHold(guestToken, '2026-12-10', '2026-12-12');
      await createTestHold(guest2Token, '2026-12-15', '2026-12-17');

      const res = await request(app)
        .get('/api/v1/bookings/mine')
        .set('Authorization', `Bearer ${guestToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
    });
  });
});
