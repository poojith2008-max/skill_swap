const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const Skill = require('../src/models/Skill');
const { connectDB, disconnectDB } = require('../src/config/db');

describe('Session State Machine & Conflict Logic Integration Tests', () => {
  let tokenA, userA;
  let tokenB, userB;
  let tokenC, userC;
  let skill;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Session.deleteMany({});
    await Skill.deleteMany({});

    skill = await Skill.create({ name: 'JavaScript', slug: 'javascript' });

    // Register User A
    const resA = await request(app).post('/api/auth/register').send({
      name: 'User A',
      email: 'usera@sessions.test',
      password: 'Password123!',
    });
    tokenA = resA.body.token;
    userA = resA.body.user;

    // Register User B
    const resB = await request(app).post('/api/auth/register').send({
      name: 'User B',
      email: 'userb@sessions.test',
      password: 'Password123!',
    });
    tokenB = resB.body.token;
    userB = resB.body.user;

    // Register User C
    const resC = await request(app).post('/api/auth/register').send({
      name: 'User C',
      email: 'userc@sessions.test',
      password: 'Password123!',
    });
    tokenC = resC.body.token;
    userC = resC.body.user;
  });

  describe('Session Proposal Rules', () => {
    it('should propose a valid session and set status to proposed', async () => {
      const futureStart = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const futureEnd = new Date(Date.now() + 25 * 3600 * 1000).toISOString(); // 60 min

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partnerId: userB._id,
          start: futureStart,
          end: futureEnd,
          topics: { proposerTeaches: skill._id },
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.session.status).toBe('proposed');
      expect(res.body.session.history).toHaveLength(1);
      expect(res.body.session.history[0].status).toBe('proposed');
    });

    it('should reject self-proposal with 400', async () => {
      const futureStart = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const futureEnd = new Date(Date.now() + 25 * 3600 * 1000).toISOString();

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partnerId: userA._id,
          start: futureStart,
          end: futureEnd,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('SELF_SESSION_NOT_ALLOWED');
    });

    it('should reject past start time with 400', async () => {
      const pastStart = new Date(Date.now() - 3600 * 1000).toISOString();
      const pastEnd = new Date(Date.now() + 1800 * 1000).toISOString();

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partnerId: userB._id,
          start: pastStart,
          end: pastEnd,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('PAST_SLOT_NOT_ALLOWED');
    });

    it('should reject invalid duration (<30 min or >180 min) with 400', async () => {
      const futureStart = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const tooShortEnd = new Date(Date.now() + 24 * 3600 * 1000 + 15 * 60 * 1000).toISOString(); // 15 min

      const res = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partnerId: userB._id,
          start: futureStart,
          end: tooShortEnd,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('INVALID_DURATION');
    });
  });

  describe('Session State Machine: Legal & Illegal Transitions', () => {
    let session;
    let futureStart, futureEnd;

    beforeEach(async () => {
      futureStart = new Date(Date.now() + 24 * 3600 * 1000);
      futureEnd = new Date(Date.now() + 25 * 3600 * 1000);

      const propRes = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          partnerId: userB._id,
          start: futureStart.toISOString(),
          end: futureEnd.toISOString(),
        });
      session = propRes.body.session;
    });

    it('proposed -> accepted: partner can accept proposal', async () => {
      const res = await request(app)
        .patch(`/api/sessions/${session._id}/accept`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.session.status).toBe('accepted');
      expect(res.body.session.history).toHaveLength(2);
      expect(res.body.session.history[1].status).toBe('accepted');
    });

    it('proposed -> accepted: proposer CANNOT accept own proposal (403)', async () => {
      const res = await request(app)
        .patch(`/api/sessions/${session._id}/accept`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('proposed -> declined: partner can decline proposal', async () => {
      const res = await request(app)
        .patch(`/api/sessions/${session._id}/decline`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.session.status).toBe('declined');
    });

    it('proposed -> countered: creates new proposal for original proposer', async () => {
      const counterStart = new Date(Date.now() + 30 * 3600 * 1000).toISOString();
      const counterEnd = new Date(Date.now() + 31 * 3600 * 1000).toISOString();

      const res = await request(app)
        .patch(`/api/sessions/${session._id}/counter`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          start: counterStart,
          end: counterEnd,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.original.status).toBe('countered');
      expect(res.body.session.status).toBe('proposed');
      expect(res.body.session.counterOf).toBe(session._id);
      expect(res.body.session.proposer._id).toBe(userB._id);
      expect(res.body.session.partner._id).toBe(userA._id);
    });

    it('proposed -> cancelled: either participant can cancel', async () => {
      const res = await request(app)
        .patch(`/api/sessions/${session._id}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.session.status).toBe('cancelled');
    });

    it('illegal transition: cannot accept a cancelled or declined session (409)', async () => {
      // First cancel it
      await request(app)
        .patch(`/api/sessions/${session._id}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`);

      // Try to accept cancelled session
      const res = await request(app)
        .patch(`/api/sessions/${session._id}/accept`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.statusCode).toBe(409);
      expect(res.body.error.code).toBe('ILLEGAL_TRANSITION');
    });
  });

  describe('Conflict Detection on Propose and Accept', () => {
    it('should reject accepting a session if either user already has an overlapping accepted session (409)', async () => {
      const t1Start = new Date(Date.now() + 20 * 3600 * 1000);
      const t1End = new Date(Date.now() + 22 * 3600 * 1000); // 20:00 to 22:00

      // User A and User B have an accepted session at t1
      const s1 = await Session.create({
        proposer: userA._id,
        partner: userB._id,
        start: t1Start,
        end: t1End,
        status: 'accepted',
      });

      // User C proposes a session to User A overlapping t1 (21:00 to 23:00)
      const t2Start = new Date(Date.now() + 21 * 3600 * 1000).toISOString();
      const t2End = new Date(Date.now() + 23 * 3600 * 1000).toISOString();

      const propRes = await request(app)
        .post('/api/sessions')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({
          partnerId: userA._id,
          start: t2Start,
          end: t2End,
        });

      // Conflict should be detected on proposal!
      expect(propRes.statusCode).toBe(409);
      expect(propRes.body.error.code).toBe('PARTNER_CONFLICT');
    });
  });

  describe('Completion Workflow (both participants must confirm)', () => {
    it('should transition to completed only after both confirm after end time', async () => {
      const pastStart = new Date(Date.now() - 2 * 3600 * 1000);
      const pastEnd = new Date(Date.now() - 1 * 3600 * 1000);

      const session = await Session.create({
        proposer: userA._id,
        partner: userB._id,
        start: pastStart,
        end: pastEnd,
        status: 'accepted',
      });

      // User A confirms
      const resA = await request(app)
        .patch(`/api/sessions/${session._id}/complete`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.statusCode).toBe(200);
      expect(resA.body.session.status).toBe('accepted');
      expect(resA.body.session.completion.proposer).toBe(true);
      expect(resA.body.session.completion.partner).toBe(false);

      // User B confirms
      const resB = await request(app)
        .patch(`/api/sessions/${session._id}/complete`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.statusCode).toBe(200);
      expect(resB.body.session.status).toBe('completed');
      expect(resB.body.session.completion.proposer).toBe(true);
      expect(resB.body.session.completion.partner).toBe(true);
    });

    it('should reject complete confirmation before end time has passed', async () => {
      const futureStart = new Date(Date.now() + 10 * 3600 * 1000);
      const futureEnd = new Date(Date.now() + 11 * 3600 * 1000);

      const session = await Session.create({
        proposer: userA._id,
        partner: userB._id,
        start: futureStart,
        end: futureEnd,
        status: 'accepted',
      });

      const res = await request(app)
        .patch(`/api/sessions/${session._id}/complete`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('SESSION_NOT_ENDED');
    });
  });
});
