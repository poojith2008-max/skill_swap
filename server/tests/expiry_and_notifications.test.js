const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const Notification = require('../src/models/Notification');
const { connectDB, disconnectDB } = require('../src/config/db');
const { checkAndExpireSessions } = require('../src/jobs/expiryJob');

describe('Cron Expiry Job & Notification Tests', () => {
  let tokenA, userA;
  let tokenB, userB;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Session.deleteMany({});
    await Notification.deleteMany({});

    const resA = await request(app).post('/api/auth/register').send({
      name: 'User One',
      email: 'user1@notifications.test',
      password: 'Password123!',
    });
    tokenA = resA.body.token;
    userA = resA.body.user;

    const resB = await request(app).post('/api/auth/register').send({
      name: 'User Two',
      email: 'user2@notifications.test',
      password: 'Password123!',
    });
    tokenB = resB.body.token;
    userB = resB.body.user;
  });

  describe('checkAndExpireSessions job logic', () => {
    it('should expire overdue proposed sessions and create notifications for both parties', async () => {
      // Overdue session 1: expiresAt in the past
      const pastExpires = new Date(Date.now() - 1000 * 60);
      const session1 = await Session.create({
        proposer: userA._id,
        partner: userB._id,
        start: new Date(Date.now() + 24 * 3600 * 1000),
        end: new Date(Date.now() + 25 * 3600 * 1000),
        status: 'proposed',
        expiresAt: pastExpires,
      });

      // Active future session: should NOT expire
      const session2 = await Session.create({
        proposer: userA._id,
        partner: userB._id,
        start: new Date(Date.now() + 40 * 3600 * 1000),
        end: new Date(Date.now() + 41 * 3600 * 1000),
        status: 'proposed',
        expiresAt: new Date(Date.now() + 30 * 3600 * 1000),
      });

      const result = await checkAndExpireSessions();
      expect(result.count).toBe(1);
      expect(result.expiredIds[0].toString()).toBe(session1._id.toString());

      const reloaded1 = await Session.findById(session1._id);
      expect(reloaded1.status).toBe('expired');
      expect(reloaded1.history.some(h => h.status === 'expired')).toBe(true);

      const reloaded2 = await Session.findById(session2._id);
      expect(reloaded2.status).toBe('proposed');

      // Verify notifications created
      const notifsA = await Notification.find({ recipient: userA._id });
      const notifsB = await Notification.find({ recipient: userB._id });
      expect(notifsA).toHaveLength(1);
      expect(notifsA[0].type).toBe('session_expired');
      expect(notifsB).toHaveLength(1);
      expect(notifsB[0].type).toBe('session_expired');
    });
  });

  describe('Notification API endpoints', () => {
    let notification;

    beforeEach(async () => {
      notification = await Notification.create({
        recipient: userA._id,
        type: 'session_proposed',
        title: 'New Session Proposal',
        message: 'User Two proposed a session with you',
      });
    });

    it('GET /api/notifications should return list of notifications and unread count', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.notifications).toHaveLength(1);
      expect(res.body.unreadCount).toBe(1);
      expect(res.body.notifications[0].title).toBe('New Session Proposal');
    });

    it('PATCH /api/notifications/:id/read should mark notification as read', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${notification._id}/read`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.notification.read).toBe(true);

      const check = await Notification.findById(notification._id);
      expect(check.read).toBe(true);
    });

    it('PATCH /api/notifications/read-all should mark all notifications read', async () => {
      await Notification.create({
        recipient: userA._id,
        type: 'session_accepted',
        title: 'Session Accepted',
        message: 'Your session was accepted',
      });

      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.statusCode).toBe(200);

      const count = await Notification.countDocuments({ recipient: userA._id, read: false });
      expect(count).toBe(0);
    });
  });
});
