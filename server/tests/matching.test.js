const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Skill = require('../src/models/Skill');
const { connectDB, disconnectDB } = require('../src/config/db');
const {
  calculateMatchScore,
  intersectUtcIntervals,
  convertSlotsToUtcIntervals,
} = require('../src/services/matching');

describe('Matching Engine Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Pure Interval Intersection & Timezone Conversion', () => {
    it('should accurately intersect 1D intervals', () => {
      const a = [
        { start: 100, end: 300 },
        { start: 500, end: 700 },
      ];
      const b = [
        { start: 200, end: 400 },
        { start: 600, end: 800 },
      ];

      const { totalMinutes, overlaps } = intersectUtcIntervals(a, b);
      // Overlap 1: 200 to 300 = 100 min
      // Overlap 2: 600 to 700 = 100 min
      expect(totalMinutes).toBe(200);
      expect(overlaps).toHaveLength(2);
      expect(overlaps[0]).toEqual({ start: 200, end: 300 });
      expect(overlaps[1]).toEqual({ start: 600, end: 700 });
    });

    it('should convert local availability slots into UTC intervals', () => {
      // User in UTC: Monday (weekday 1) 10:00 to 12:00 -> 1*1440 + 600 = 2040 to 2160
      const slots = [{ weekday: 1, startMin: 600, endMin: 720 }];
      const utcIntervals = convertSlotsToUtcIntervals(slots, 'UTC');

      expect(utcIntervals).toHaveLength(1);
      expect(utcIntervals[0]).toEqual({ start: 2040, end: 2160 });
    });
  });

  describe('Pure calculateMatchScore logic', () => {
    const skillAId = new mongoose.Types.ObjectId();
    const skillBId = new mongoose.Types.ObjectId();
    const skillCId = new mongoose.Types.ObjectId();

    const skillA = { _id: skillAId, name: 'Python' };
    const skillB = { _id: skillBId, name: 'Guitar' };
    const skillC = { _id: skillCId, name: 'Origami' };

    it('should detect mutual match (+50) with level fit and availability score', () => {
      const userA = {
        _id: new mongoose.Types.ObjectId(),
        timezone: 'UTC',
        skillsOffered: [{ skill: skillA, level: 'expert' }],
        skillsWanted: [{ skill: skillB }],
        availability: [{ weekday: 1, startMin: 600, endMin: 720 }], // 2 hours
        reputation: { bayesian: 3.5 },
      };

      const userB = {
        _id: new mongoose.Types.ObjectId(),
        timezone: 'UTC',
        skillsOffered: [{ skill: skillB, level: 'intermediate' }],
        skillsWanted: [{ skill: skillA }],
        availability: [{ weekday: 1, startMin: 600, endMin: 720 }], // 2 hours
        reputation: { bayesian: 4.0 },
      };

      const match = calculateMatchScore(userA, userB);
      expect(match).not.toBeNull();
      expect(match.isMutual).toBe(true);
      // Base: 50
      // Level fit: 5
      // Overlap: 2 hours * 2 = 4
      // Rep boost: (4.0 - 3) * 3 = 3
      // Expected total: 50 + 5 + 4 + 3 = 62
      expect(match.score).toBe(62);
      expect(match.explanation).toContain('Mutual match');
      expect(match.sharedSlots.length).toBeGreaterThan(0);
    });

    it('should detect one-way match (+20) when only one direction matches', () => {
      const userA = {
        _id: new mongoose.Types.ObjectId(),
        timezone: 'UTC',
        skillsOffered: [{ skill: skillA, level: 'intermediate' }],
        skillsWanted: [{ skill: skillB }],
        availability: [],
        reputation: { bayesian: 3.0 },
      };

      // User C offers Origami (A doesn't want) but wants Python (A offers)
      const userC = {
        _id: new mongoose.Types.ObjectId(),
        timezone: 'UTC',
        skillsOffered: [{ skill: skillC, level: 'beginner' }],
        skillsWanted: [{ skill: skillA }],
        availability: [],
        reputation: { bayesian: 3.0 },
      };

      const match = calculateMatchScore(userA, userC);
      expect(match).not.toBeNull();
      expect(match.isMutual).toBe(false);
      // Base: 20
      // Level fit: 5 (since userA teaches Python at intermediate level)
      // Availability: 0
      // Rep boost: (3.0 - 3) * 3 = 0
      // Total: 25
      expect(match.score).toBe(25);
    });

    it('should return null (exclude) when there is zero skill overlap', () => {
      const userA = {
        _id: new mongoose.Types.ObjectId(),
        timezone: 'UTC',
        skillsOffered: [{ skill: skillA, level: 'intermediate' }],
        skillsWanted: [{ skill: skillB }],
      };

      const userUnrelated = {
        _id: new mongoose.Types.ObjectId(),
        timezone: 'UTC',
        skillsOffered: [{ skill: skillC, level: 'intermediate' }],
        skillsWanted: [{ skill: skillC }],
      };

      const match = calculateMatchScore(userA, userUnrelated);
      expect(match).toBeNull();
    });
  });

  describe('GET /api/matches endpoint', () => {
    let tokenA;
    let userAId;

    beforeEach(async () => {
      await User.deleteMany({});
      await Skill.deleteMany({});

      const pySkill = await Skill.create({ name: 'Python', slug: 'python', aliases: ['py'] });
      const guitarSkill = await Skill.create({ name: 'Guitar', slug: 'guitar', aliases: [] });

      // User A (requests matches)
      const resA = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Learner',
          email: 'alice@matches.test',
          password: 'Password123!',
          timezone: 'Asia/Kolkata',
        });
      tokenA = resA.body.token;
      userAId = resA.body.user._id;

      await User.findByIdAndUpdate(userAId, {
        skillsOffered: [{ skill: pySkill._id, level: 'expert' }],
        skillsWanted: [{ skill: guitarSkill._id }],
        availability: [{ weekday: 2, startMin: 600, endMin: 720 }],
      });

      // User B (Mutual Match partner)
      const resB = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bob Guitarist',
          email: 'bob@matches.test',
          password: 'Password123!',
          timezone: 'Asia/Kolkata',
        });
      await User.findByIdAndUpdate(resB.body.user._id, {
        skillsOffered: [{ skill: guitarSkill._id, level: 'intermediate' }],
        skillsWanted: [{ skill: pySkill._id }],
        availability: [{ weekday: 2, startMin: 600, endMin: 720 }],
      });

      // User C (Zero match user)
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Charlie Cook',
          email: 'charlie@matches.test',
          password: 'Password123!',
          timezone: 'Asia/Kolkata',
        });
    });

    it('should return ranked matches excluding self and zero-overlap candidates', async () => {
      const res = await request(app)
        .get('/api/matches')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.matches).toHaveLength(1);
      expect(res.body.matches[0].user.name).toBe('Bob Guitarist');
      expect(res.body.matches[0].isMutual).toBe(true);
      expect(res.body.matches[0].explanation).toContain('Mutual match');
      expect(res.body.matches[0].sharedSlots.length).toBeGreaterThan(0);
    });
  });
});
