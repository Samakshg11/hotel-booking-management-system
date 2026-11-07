const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');
const RoomType = require('../../src/models/RoomType');
const Room = require('../../src/models/Room');
const { getTodayUtcString } = require('../../src/utils/dates');

describe('Rooms & Availability Integration Tests', () => {
  let guestToken;
  let staffToken;
  let adminToken;
  let roomType;

  beforeEach(async () => {
    const passwordHash = await User.hashPassword('Password123!');
    const [guest, staff, admin] = await User.create([
      { name: 'Guest', email: 'guest@demo.test', passwordHash, role: 'guest' },
      { name: 'Staff', email: 'staff@demo.test', passwordHash, role: 'staff' },
      { name: 'Admin', email: 'admin@demo.test', passwordHash, role: 'admin' },
    ]);

    const guestLogin = await request(app).post('/api/v1/auth/login').send({ email: 'guest@demo.test', password: 'Password123!' });
    const staffLogin = await request(app).post('/api/v1/auth/login').send({ email: 'staff@demo.test', password: 'Password123!' });
    const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: 'admin@demo.test', password: 'Password123!' });

    guestToken = guestLogin.body.data.token;
    staffToken = staffLogin.body.data.token;
    adminToken = adminLogin.body.data.token;

    roomType = await RoomType.create({
      name: 'Standard Queen',
      description: 'Comfortable queen room',
      capacity: 2,
      baseRate: 400000, // ₹4,000.00
      amenities: ['Queen Bed', 'Wi-Fi'],
    });

    await Room.create([
      { roomNumber: '101', roomTypeId: roomType._id, floor: 1, status: 'available' },
      { roomNumber: '102', roomTypeId: roomType._id, floor: 1, status: 'available' },
      { roomNumber: '103', roomTypeId: roomType._id, floor: 1, status: 'maintenance' },
    ]);
  });

  describe('Room Types & Rooms Management (RBAC)', () => {
    it('should allow public to list room types', async () => {
      const res = await request(app).get('/api/v1/room-types');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
    });

    it('should reject non-admin from creating room types with 403', async () => {
      const res = await request(app)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          name: 'Executive Suite',
          capacity: 4,
          baseRate: 800000,
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toHaveProperty('code', 'FORBIDDEN');
    });

    it('should allow admin to create a new room type', async () => {
      const res = await request(app)
        .post('/api/v1/room-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Executive Suite',
          capacity: 4,
          baseRate: 800000,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Executive Suite');
    });

    it('should allow staff to view rooms list', async () => {
      const res = await request(app)
        .get('/api/v1/rooms')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
    });

    it('should allow staff to update room status (e.g. maintenance)', async () => {
      const room = await Room.findOne({ roomNumber: '101' });

      const res = await request(app)
        .patch(`/api/v1/rooms/${room._id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'maintenance' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('maintenance');
    });
  });

  describe('GET /api/v1/availability', () => {
    it('should return availability count and itemized pricing breakdown', async () => {
      const today = getTodayUtcString();
      const checkIn = today;
      const checkOut = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const res = await request(app).get(`/api/v1/availability?checkIn=${checkIn}&checkOut=${checkOut}&guests=2`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].availableCount).toBe(2); // 101 and 102 are available; 103 is in maintenance
      expect(res.body.data[0].pricing).toHaveProperty('subtotal', 800000); // 2 nights * 400000
      expect(res.body.data[0].pricing).toHaveProperty('tax', 96000); // 12% of 800000
      expect(res.body.data[0].pricing).toHaveProperty('total', 896000);
      expect(res.body.data[0].pricing.nightly.length).toBe(2);
    });

    it('should reject invalid dates (checkOut <= checkIn)', async () => {
      const today = getTodayUtcString();
      const res = await request(app).get(`/api/v1/availability?checkIn=${today}&checkOut=${today}&guests=2`);

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });
});

