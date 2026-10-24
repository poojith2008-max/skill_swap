const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const Review = require('../src/models/Review');
const { connectDB, disconnectDB } = require('../src/config/db');
const { calculateBayesianReputation } = require('../src/services/reputation');

describe('Reviews & Bayesian Reputation Integration Tests', () => {
  let tokenA, userA;
  let tokenB, userB;
  let tokenC, userC;
  let completedSession;
  let pendingSession;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Session.deleteMany({});
    await Review.deleteMany({});

    // User A
    const resA = await request(app).post('/api/auth/register').send({
      name: 'Alice Tutor',
      email: 'alice@reviews.test',
      password: 'Password123!',
    });
    tokenA = resA.body.token;
    userA = resA.body.user;

    // User B
    const resB = await request(app).post('/api/auth/register').send({
      name: 'Bob Student',
      email: 'bob@reviews.test',
      password: 'Password123!',
    });
    tokenB = resB.body.token;
    userB = resB.body.user;

    // User C (outsider)
    const resC = await request(app).post('/api/auth/register').send({
      name: 'Charlie Outsider',
      email: 'charlie@reviews.test',
      password: 'Password123!',
    });
    tokenC = resC.body.token;
    userC = resC.body.user;

    // Create a completed session
    completedSession = await Session.create({
      proposer: userA._id,
      partner: userB._id,
      start: new Date(Date.now() - 3 * 3600 * 1000),
      end: new Date(Date.now() - 2 * 3600 * 1000),
      status: 'completed',
      completion: { proposer: true, partner: true },
    });

    // Create an uncompleted proposed session
    pendingSession = await Session.create({
      proposer: userA._id,
      partner: userB._id,
      start: new Date(Date.now() + 24 * 3600 * 1000),
      end: new Date(Date.now() + 25 * 3600 * 1000),
      status: 'proposed',
    });
  });

  describe('Pure Bayesian Average Unit Test', () => {
    it('MANDATORY TEST: 1 review of 5 stars ranks BELOW 20 reviews averaging 4.8', () => {
      // Prior: m = 3.5, C = 5
      // 1 review of 5 stars:
      const singleReview = calculateBayesianReputation([5]);
      // (5 * 3.5 + 5) / (5 + 1) = 22.5 / 6 = 3.75
      expect(singleReview.bayesian).toBe(3.75);
      expect(singleReview.avg).toBe(5);
      expect(singleReview.count).toBe(1);

      // 20 reviews averaging 4.8:
      // Let's create an array of 20 ratings with average 4.8: sixteen 5s and four 4s: (16*5 + 4*4)/20 = (80+16)/20 = 96/20 = 4.8
      const veteranRatings = Array(16).fill(5).concat(Array(4).fill(4));
      const veteranReviews = calculateBayesianReputation(veteranRatings);
      // (5 * 3.5 + 96) / (5 + 20) = 113.5 / 25 = 4.54
      expect(veteranReviews.avg).toBe(4.8);
      expect(veteranReviews.count).toBe(20);
      expect(veteranReviews.bayesian).toBe(4.54);

      // Verify that 1 review of 5 stars strictly ranks BELOW 20 reviews averaging 4.8
      expect(singleReview.bayesian).toBeLessThan(veteranReviews.bayesian);
    });

    it('should return prior mean (3.5) when there are zero reviews', () => {
      const zeroReview = calculateBayesianReputation([]);
      expect(zeroReview.bayesian).toBe(3.5);
      expect(zeroReview.count).toBe(0);
      expect(zeroReview.avg).toBe(0);
    });
  });

  describe('POST /api/reviews endpoint', () => {
    it('should submit a review on a completed session and update reviewee reputation', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          sessionId: completedSession._id,
          rating: 5,
          comment: 'Outstanding teaching! Very patient.',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.review.rating).toBe(5);
      expect(res.body.revieweeReputation.count).toBe(1);
      expect(res.body.revieweeReputation.avg).toBe(5);
      expect(res.body.revieweeReputation.bayesian).toBe(3.75);

      // Verify User record updated in DB
      const updatedUserA = await User.findById(userA._id);
      expect(updatedUserA.reputation.count).toBe(1);
      expect(updatedUserA.reputation.bayesian).toBe(3.75);
    });

    it('should reject review on uncompleted session with 400', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          sessionId: pendingSession._id,
          rating: 5,
          comment: 'Trying early review',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('SESSION_NOT_COMPLETED');
    });

    it('should reject duplicate review for the same session with 409', async () => {
      // First review
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          sessionId: completedSession._id,
          rating: 5,
          comment: 'First review',
        });

      // Second review by same reviewer
      const duplicateRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          sessionId: completedSession._id,
          rating: 4,
          comment: 'Duplicate attempt',
        });

      expect(duplicateRes.statusCode).toBe(409);
      expect(duplicateRes.body.error.code).toBe('DUPLICATE_REVIEW');
    });

    it('should reject non-participant from reviewing with 403', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({
          sessionId: completedSession._id,
          rating: 5,
          comment: 'Intruder review',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('GET /api/users/:id/reviews', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          sessionId: completedSession._id,
          rating: 5,
          comment: 'Great session!',
        });
    });

    it('should retrieve list of verified reviews for a user', async () => {
      const res = await request(app).get(`/api/users/${userA._id}/reviews`);

      expect(res.statusCode).toBe(200);
      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.reviews[0].comment).toBe('Great session!');
      expect(res.body.reviews[0].reviewer.name).toBe('Bob Student');
      expect(res.body.user.name).toBe('Alice Tutor');
    });
  });
});
