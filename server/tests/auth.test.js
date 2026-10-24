const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Auth & User Model Integration Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully with hashed password and token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Developer',
          email: 'alice@example.com',
          password: 'Password123!',
          bio: 'Fullstack coder learning Spanish',
          timezone: 'Asia/Kolkata',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.name).toBe('Alice Developer');
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('password');

      // Verify DB persistence and password hashing
      const savedUser = await User.findOne({ email: 'alice@example.com' }).select('+passwordHash');
      expect(savedUser).toBeTruthy();
      expect(savedUser.passwordHash).not.toBe('Password123!');
      const isMatch = await savedUser.comparePassword('Password123!');
      expect(isMatch).toBe(true);
    });

    it('should reject registration with duplicate email with 409', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'First User',
          email: 'duplicate@example.com',
          password: 'Password123!',
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Second User',
          email: 'duplicate@example.com',
          password: 'Password123!',
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toHaveProperty('code', 'EMAIL_EXISTS');
    });

    it('should reject invalid email or short password with 422', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'A',
          email: 'not-an-email',
          password: '123',
        });

      expect(res.statusCode).toBe(422);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
      expect(res.body.error).toHaveProperty('details');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      const passwordHash = await User.hashPassword('Secret123!');
      await User.create({
        name: 'Bob Tester',
        email: 'bob@example.com',
        passwordHash,
      });
    });

    it('should log in successfully with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bob@example.com',
          password: 'Secret123!',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('bob@example.com');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject login with wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bob@example.com',
          password: 'WrongPassword!',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent email with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ghost@example.com',
          password: 'Secret123!',
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const passwordHash = await User.hashPassword('Secret123!');
      const user = await User.create({
        name: 'Charlie Current',
        email: 'charlie@example.com',
        passwordHash,
      });
      userId = user._id;

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'charlie@example.com',
          password: 'Secret123!',
        });
      token = loginRes.body.token;
    });

    it('should return current user when authenticated with Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.email).toBe('charlie@example.com');
      expect(res.body.user._id).toBe(userId.toString());
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject request with no token with 401', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });

    it('should reject request with forged/invalid token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_forged_token_here');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 200 message', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
  });
});
