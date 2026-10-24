const cron = require('node-cron');
const Session = require('../models/Session');
const { createNotification } = require('../services/notificationService');

/**
 * Pure business logic function to check and expire overdue session proposals.
 * Returns the count and IDs of expired sessions.
 */
const checkAndExpireSessions = async () => {
  const now = new Date();

  // Find proposed sessions past their expiration time or past their scheduled start
  const overdueSessions = await Session.find({
    status: 'proposed',
    $or: [
      { expiresAt: { $lte: now } },
      { start: { $lte: now } },
    ],
  });

  const expiredIds = [];

  for (const session of overdueSessions) {
    session.status = 'expired';
    session.history.push({
      status: 'expired',
      by: session.proposer,
      at: now,
      note: 'Auto-expired due to 48-hour timeout or scheduled start passing',
    });

    await session.save();
    expiredIds.push(session._id);

    // Notify proposer
    await createNotification({
      recipient: session.proposer,
      type: 'session_expired',
      title: 'Session Proposal Expired',
      message: 'Your session proposal has expired because it was not accepted within the response window.',
      data: { sessionId: session._id },
    });

    // Notify partner
    await createNotification({
      recipient: session.partner,
      type: 'session_expired',
      title: 'Session Proposal Expired',
      message: 'A session proposal you received has expired.',
      data: { sessionId: session._id },
    });
  }

  return {
    count: expiredIds.length,
    expiredIds,
  };
};

/**
 * Starts the node-cron scheduler (runs every 10 minutes)
 */
const startExpiryCron = (io) => {
  // Cron pattern: every 10 minutes '*/10 * * * *'
  const task = cron.schedule('*/10 * * * *', async () => {
    try {
      const result = await checkAndExpireSessions();
      if (result.count > 0) {
        console.log(`⏰ [Cron] Auto-expired ${result.count} session proposal(s)`);
      }
    } catch (error) {
      console.error('❌ Error executing session expiry cron job:', error);
    }
  });

  return task;
};

module.exports = {
  checkAndExpireSessions,
  startExpiryCron,
};
