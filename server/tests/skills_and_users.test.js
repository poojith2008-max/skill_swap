const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Skill = require('../src/models/Skill');
const { connectDB, disconnectDB } = require('../src/config/db');
const { resolveSkill } = require('../src/utils/skillResolver');
const { normalizeAvailability } = require('../src/services/availability');
const skillsSeedData = require('../src/seed/skillsData');

describe('Skills, User Profile & Availability Tests', () => {
  let token;
  let testUser;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Skill.deleteMany({});

    // Seed base skills
    await Skill.insertMany(skillsSeedData);

    // Register a test user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dev Dave',
        email: 'dave@skillswap.dev',
        password: 'Password123!',
        bio: 'Passionate developer',
        timezone: 'Asia/Kolkata',
      });

    token = regRes.body.token;
    testUser = regRes.body.user;
  });

  describe('Skill Resolver Utility', () => {
    it('should resolve existing skill by slug', async () => {
      const skill = await resolveSkill('python');
      expect(skill).toBeTruthy();
      expect(skill.name).toBe('Python');
    });

    it('should resolve existing skill by alias (e.g. js -> JavaScript)', async () => {
      const skill = await resolveSkill('js');
      expect(skill).toBeTruthy();
      expect(skill.name).toBe('JavaScript');
    });

    it('should resolve existing skill by case-insensitive name', async () => {
      const skill = await resolveSkill('acoustic guitar');
      expect(skill).toBeTruthy();
      expect(skill.name).toBe('Acoustic Guitar');
    });

    it('should dynamically create new skill when not found', async () => {
      const countBefore = await Skill.countDocuments();
      const newSkill = await resolveSkill('Quantum Computing');
      expect(newSkill).toBeTruthy();
      expect(newSkill.name).toBe('Quantum Computing');
      expect(newSkill.slug).toBe('quantum-computing');

      const countAfter = await Skill.countDocuments();
      expect(countAfter).toBe(countBefore + 1);
    });
  });

  describe('GET /api/skills?q=', () => {
    it('should return skills matching query autocomplete', async () => {
      const res = await request(app).get('/api/skills?q=py');
      expect(res.statusCode).toBe(200);
      expect(res.body.skills.length).toBeGreaterThan(0);
      const names = res.body.skills.map(s => s.name);
      expect(names).toContain('Python');
    });

    it('should return catalog when no query is given', async () => {
      const res = await request(app).get('/api/skills');
      expect(res.statusCode).toBe(200);
      expect(res.body.skills.length).toBeGreaterThan(20);
    });
  });

  describe('normalizeAvailability service', () => {
    it('should merge adjacent intervals on the same day', () => {
      const raw = [
        { weekday: 1, startMin: 540, endMin: 600 },
        { weekday: 1, startMin: 600, endMin: 720 },
      ];
      const result = normalizeAvailability(raw);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        weekday: 1,
        startMin: 540,
        endMin: 720,
      });
    });

    it('should merge overlapping intervals on the same day', () => {
      const raw = [
        { weekday: 2, startMin: 540, endMin: 660 },
        { weekday: 2, startMin: 600, endMin: 720 },
      ];
      const result = normalizeAvailability(raw);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        weekday: 2,
        startMin: 540,
        endMin: 720,
      });
    });

    it('should reject intervals where start >= end', () => {
      const invalid = [{ weekday: 1, startMin: 600, endMin: 540 }];
      expect(() => normalizeAvailability(invalid)).toThrow();
    });
  });

  describe('PUT /api/users/me & /api/users/me/availability', () => {
    it('should update bio, timezone, skills offered and wanted', async () => {
      const res = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          bio: 'Updated bio here',
          timezone: 'America/New_York',
          skillsOffered: [
            { skill: 'Python', level: 'expert' },
            { skill: 'Docker', level: 'intermediate' },
          ],
          skillsWanted: [{ skill: 'Spanish' }],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.user.bio).toBe('Updated bio here');
      expect(res.body.user.timezone).toBe('America/New_York');
      expect(res.body.user.skillsOffered).toHaveLength(2);
      expect(res.body.user.skillsWanted).toHaveLength(1);
    });

    it('should update availability and merge adjacent slots', async () => {
      const res = await request(app)
        .put('/api/users/me/availability')
        .set('Authorization', `Bearer ${token}`)
        .send({
          availability: [
            { weekday: 0, startMin: 600, endMin: 720 },
            { weekday: 0, startMin: 720, endMin: 840 },
          ],
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.availability).toHaveLength(1);
      expect(res.body.availability[0]).toEqual(
        expect.objectContaining({
          weekday: 0,
          startMin: 600,
          endMin: 840,
        })
      );
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return public profile of a user', async () => {
      const res = await request(app).get(`/api/users/${testUser._id}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.name).toBe('Dev Dave');
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('email');
    });

    it('should return 400 for invalid ObjectId format', async () => {
      const res = await request(app).get('/api/users/invalid-id-123');
      expect(res.statusCode).toBe(422);
      expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should return 404 for non-existent ObjectId', async () => {
      const res = await request(app).get('/api/users/60c72b2f9b1d8b2bad8f4e2a');
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toHaveProperty('code', 'USER_NOT_FOUND');
    });
  });
});
