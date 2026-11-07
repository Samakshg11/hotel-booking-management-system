const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');

describe('Auth & RBAC Integration Tests', () => {
  const testGuest = {
    name: 'Alice Guest',
    email: 'alice@example.com',
    password: 'Password123!',
    phone: '+91 99999 88888',
  };

  describe('POST /api/v1/auth/register', () => {
    it('should register a new guest and return 201 with token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testGuest);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user).toHaveProperty('email', 'alice@example.com');
      expect(res.body.data.user).toHaveProperty('role', 'guest');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');

      const savedUser = await User.findOne({ email: 'alice@example.com' });
      expect(savedUser).not.toBeNull();
      expect(savedUser.role).toBe('guest');
    });

    it('should reject registration if email is already taken', async () => {
      await request(app).post('/api/v1/auth/register').send(testGuest);

      const res = await request(app).post('/api/v1/auth/register').send(testGuest);

      expect(res.status).toBe(409);
      expect(res.body.error).toHaveProperty('code', 'EMAIL_ALREADY_EXISTS');
    });

    it('should reject registration with invalid email or password', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'A',
        email: 'invalid-email',
        password: '123',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send(testGuest);
    });

    it('should log in successfully with correct credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testGuest.email,
        password: testGuest.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.email).toBe(testGuest.email);
    });

    it('should fail with 401 when password is wrong', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: testGuest.email,
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should fail with 401 for non-existent email', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 if no token is provided', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should return user profile when valid token is provided', async () => {
      const reg = await request(app).post('/api/v1/auth/register').send(testGuest);
      const token = reg.body.data.token;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user).toHaveProperty('email', testGuest.email);
      expect(res.body.data.user).toHaveProperty('role', 'guest');
    });
  });
});
