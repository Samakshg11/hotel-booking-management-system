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

describe('Front Desk Operations, Reports & Audit Integration Tests', () => {
  let guestUser;
  let guestToken;
  let staffToken;
  let adminToken;
  let roomType;
  let room;

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123!');
    const [guest, staff, admin] = await User.create([
      { name: 'John Guest', email: 'guest@demo.test', passwordHash, role: 'guest', phone: '+91 98765 11111' },
      { name: 'Front Desk Staff', email: 'staff@demo.test', passwordHash, role: 'staff' },
      { name: 'Admin User', email: 'admin@demo.test', passwordHash, role: 'admin' },
    ]);

    guestUser = guest;

    const res1 = await request(app).post('/api/v1/auth/login').send({ email: 'guest@demo.test', password: 'Password123!' });
    const res2 = await request(app).post('/api/v1/auth/login').send({ email: 'staff@demo.test', password: 'Password123!' });
    const res3 = await request(app).post('/api/v1/auth/login').send({ email: 'admin@demo.test', password: 'Password123!' });

    guestToken = res1.body.data.token;
    staffToken = res2.body.data.token;
    adminToken = res3.body.data.token;

    roomType = await RoomType.create({
      name: 'Deluxe City View',
      capacity: 2,
      baseRate: 500000, // ₹5,000.00
    });

    room = await Room.create({
      roomNumber: '101',
      roomTypeId: roomType._id,
      floor: 1,
      status: 'available',
    });
  });

  async function createConfirmedBooking(checkIn = getTodayUtcString(), checkOut = '2026-11-20') {
    const holdRes = await request(app)
      .post('/api/v1/bookings/hold')
      .set('Authorization', `Bearer ${guestToken}`)
      .send({
        roomTypeId: roomType._id.toString(),
        checkIn,
        checkOut,
        guests: 2,
      });

    const holdId = holdRes.body.data._id;

    await request(app)
      .post(`/api/v1/bookings/${holdId}/confirm`)
      .set('Authorization', `Bearer ${guestToken}`)
      .set('Idempotency-Key', `confirm-fd-${holdId}`)
      .send({ cardNumber: '4111222233334444' });

    return Booking.findById(holdId);
  }

  describe('Front Desk Check-In & Check-Out Workflows', () => {
    it('should allow staff to check in a confirmed booking on arrival date', async () => {
      const today = getTodayUtcString();
      const booking = await createConfirmedBooking(today, '2026-11-25');

      const res = await request(app)
        .post(`/api/v1/bookings/${booking._id}/check-in`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CHECKED_IN');

      const audit = await AuditLog.findOne({ entityId: booking._id.toString(), action: 'BOOKING_CHECK_IN' });
      expect(audit).not.toBeNull();
    });

    it('should reject early check-in before checkIn date with 400 EARLY_CHECKIN_PROHIBITED', async () => {
      const futureCheckIn = '2026-12-01';
      const booking = await createConfirmedBooking(futureCheckIn, '2026-12-05');

      const res = await request(app)
        .post(`/api/v1/bookings/${booking._id}/check-in`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'EARLY_CHECKIN_PROHIBITED');
    });

    it('should allow staff to check out a checked-in booking', async () => {
      const today = getTodayUtcString();
      const booking = await createConfirmedBooking(today, '2026-11-25');

      // Check in
      await request(app)
        .post(`/api/v1/bookings/${booking._id}/check-in`)
        .set('Authorization', `Bearer ${staffToken}`);

      // Check out
      const res = await request(app)
        .post(`/api/v1/bookings/${booking._id}/check-out`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('CHECKED_OUT');

      const audit = await AuditLog.findOne({ entityId: booking._id.toString(), action: 'BOOKING_CHECK_OUT' });
      expect(audit).not.toBeNull();
    });

    it('should reject guest attempting to call check-in endpoint with 403', async () => {
      const today = getTodayUtcString();
      const booking = await createConfirmedBooking(today, '2026-11-25');

      const res = await request(app)
        .post(`/api/v1/bookings/${booking._id}/check-in`)
        .set('Authorization', `Bearer ${guestToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });
  });

  describe('Guest Directory (Staff & Admin)', () => {
    it('should allow staff to search guests and retrieve profile with history', async () => {
      const today = getTodayUtcString();
      await createConfirmedBooking(today, '2026-11-20');

      // Search guests
      const listRes = await request(app)
        .get('/api/v1/guests?search=John')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBe(1);
      expect(listRes.body.data[0].email).toBe('guest@demo.test');

      // View guest with history
      const detailRes = await request(app)
        .get(`/api/v1/guests/${guestUser._id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.guest.email).toBe('guest@demo.test');
      expect(detailRes.body.data.bookings.length).toBe(1);
    });
  });

  describe('Reports Reconciliation & Audit Logs (Admin)', () => {
    it('should reconcile revenue, occupancy % and status counts against raw data', async () => {
      const today = getTodayUtcString();
      const booking = await createConfirmedBooking(today, '2026-11-15');

      const res = await request(app)
        .get(`/api/v1/reports/summary?from=${today}&to=2026-11-15`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.revenue.total).toBe(booking.price.total);
      expect(res.body.data.revenue.qualifyingBookings).toBe(1);
      expect(res.body.data.occupancy.occupiedRoomNights).toBeGreaterThanOrEqual(1);
      expect(res.body.data.countsByStatus.CONFIRMED).toBe(1);
    });

    it('should query arrivals and departures for front desk', async () => {
      const today = getTodayUtcString();
      await createConfirmedBooking(today, '2026-11-15');

      const arrivalsRes = await request(app)
        .get(`/api/v1/reports/arrivals?from=${today}&to=${today}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(arrivalsRes.status).toBe(200);
      expect(arrivalsRes.body.data.length).toBe(1);
    });

    it('should allow admin to inspect audit logs and change user roles', async () => {
      // 1. Change user role
      const roleRes = await request(app)
        .patch(`/api/v1/admin/users/${guestUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'staff' });

      expect(roleRes.status).toBe(200);
      expect(roleRes.body.data.role).toBe('staff');

      // 2. Query audit logs
      const auditRes = await request(app)
        .get('/api/v1/audit-logs?entityType=User')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditRes.status).toBe(200);
      expect(auditRes.body.data.length).toBeGreaterThanOrEqual(1);
      expect(auditRes.body.data[0].action).toBe('USER_ROLE_CHANGE');
    });
  });
});
