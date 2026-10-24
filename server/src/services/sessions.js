const Session = require('../models/Session');
const User = require('../models/User');
const AppError = require('../utils/AppError');

/**
 * Checks if a user has an accepted session overlapping with [start, end].
 */
const hasAcceptedConflict = async (userId, start, end, excludeSessionId = null) => {
  const query = {
    $or: [{ proposer: userId }, { partner: userId }],
    status: 'accepted',
    start: { $lt: end },
    end: { $gt: start },
  };

  if (excludeSessionId) {
    query._id = { $ne: excludeSessionId };
  }

  const conflictingSession = await Session.findOne(query);
  return conflictingSession;
};

/**
 * Proposes a new session between proposer and partner.
 */
const proposeSession = async (proposerId, { partnerId, start, end, topics = {} }) => {
  if (proposerId.toString() === partnerId.toString()) {
    throw new AppError('You cannot propose a session with yourself', 400, 'SELF_SESSION_NOT_ALLOWED');
  }

  const partner = await User.findById(partnerId);
  if (!partner) {
    throw new AppError('Partner not found', 404, 'USER_NOT_FOUND');
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  const now = new Date();

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new AppError('Invalid date format for session start or end', 400, 'INVALID_DATE');
  }

  if (startDate <= now) {
    throw new AppError('Session slot must be scheduled in the future', 400, 'PAST_SLOT_NOT_ALLOWED');
  }

  const durationMin = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
  if (durationMin < 30 || durationMin > 180) {
    throw new AppError('Session duration must be between 30 and 180 minutes', 400, 'INVALID_DURATION');
  }

  // Conflict check: neither user may have an overlapping accepted session
  const proposerConflict = await hasAcceptedConflict(proposerId, startDate, endDate);
  if (proposerConflict) {
    throw new AppError('You already have an accepted session during this time slot', 409, 'PROPOSER_CONFLICT');
  }

  const partnerConflict = await hasAcceptedConflict(partnerId, startDate, endDate);
  if (partnerConflict) {
    throw new AppError('Partner already has an accepted session during this time slot', 409, 'PARTNER_CONFLICT');
  }

  // Duplicate proposal check: no active proposal between same pair with overlapping slot
  const duplicateProposal = await Session.findOne({
    $or: [
      { proposer: proposerId, partner: partnerId },
      { proposer: partnerId, partner: proposerId },
    ],
    status: 'proposed',
    start: { $lt: endDate },
    end: { $gt: startDate },
  });

  if (duplicateProposal) {
    throw new AppError('An active proposal already exists for this pair and overlapping slot', 409, 'DUPLICATE_PROPOSAL');
  }

  // Auto-expiry: 48 hours from now or session start time, whichever is earlier
  const expiresAt = new Date(Math.min(startDate.getTime(), Date.now() + 48 * 60 * 60 * 1000));

  const session = await Session.create({
    proposer: proposerId,
    partner: partnerId,
    start: startDate,
    end: endDate,
    topics: {
      proposerTeaches: topics.proposerTeaches || null,
      partnerTeaches: topics.partnerTeaches || null,
    },
    status: 'proposed',
    expiresAt,
    history: [
      {
        status: 'proposed',
        by: proposerId,
        at: new Date(),
        note: 'Session proposal created',
      },
    ],
  });

  return session;
};

/**
 * Accepts a session proposal. Only the partner may accept.
 * Atomic check-and-update to prevent race conditions.
 */
const acceptSession = async (sessionId, userId) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  if (session.partner.toString() !== userId.toString()) {
    throw new AppError('Only the partner may accept this session proposal', 403, 'FORBIDDEN');
  }

  if (session.status !== 'proposed') {
    throw new AppError(
      `Cannot accept session with status '${session.status}'. Must be 'proposed'`,
      409,
      'ILLEGAL_TRANSITION'
    );
  }

  // Conflict check for both users before accepting
  const proposerConflict = await hasAcceptedConflict(session.proposer, session.start, session.end, session._id);
  if (proposerConflict) {
    throw new AppError('Proposer has an overlapping accepted session', 409, 'PROPOSER_CONFLICT');
  }

  const partnerConflict = await hasAcceptedConflict(session.partner, session.start, session.end, session._id);
  if (partnerConflict) {
    throw new AppError('You have an overlapping accepted session during this time', 409, 'PARTNER_CONFLICT');
  }

  // Atomic conditional update on status === 'proposed'
  const updated = await Session.findOneAndUpdate(
    { _id: sessionId, status: 'proposed' },
    {
      $set: { status: 'accepted' },
      $push: {
        history: {
          status: 'accepted',
          by: userId,
          at: new Date(),
          note: 'Session accepted by partner',
        },
      },
    },
    { new: true }
  )
    .populate('proposer', 'name email timezone reputation')
    .populate('partner', 'name email timezone reputation')
    .populate('topics.proposerTeaches')
    .populate('topics.partnerTeaches');

  if (!updated) {
    throw new AppError('Session was updated or expired by another concurrent action', 409, 'CONCURRENT_CONFLICT');
  }

  return updated;
};

/**
 * Declines a session proposal. Only the partner may decline.
 */
const declineSession = async (sessionId, userId) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  if (session.partner.toString() !== userId.toString()) {
    throw new AppError('Only the partner may decline this session proposal', 403, 'FORBIDDEN');
  }

  if (session.status !== 'proposed') {
    throw new AppError(
      `Cannot decline session with status '${session.status}'. Must be 'proposed'`,
      409,
      'ILLEGAL_TRANSITION'
    );
  }

  const updated = await Session.findOneAndUpdate(
    { _id: sessionId, status: 'proposed' },
    {
      $set: { status: 'declined' },
      $push: {
        history: {
          status: 'declined',
          by: userId,
          at: new Date(),
          note: 'Session declined by partner',
        },
      },
    },
    { new: true }
  );

  return updated;
};

/**
 * Counter-proposal: marks original as 'countered', creates new session in 'proposed'
 */
const counterSession = async (sessionId, userId, { start, end }) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  if (session.partner.toString() !== userId.toString()) {
    throw new AppError('Only the partner may counter this session proposal', 403, 'FORBIDDEN');
  }

  if (session.status !== 'proposed') {
    throw new AppError(
      `Cannot counter session with status '${session.status}'. Must be 'proposed'`,
      409,
      'ILLEGAL_TRANSITION'
    );
  }

  const newStart = new Date(start);
  const newEnd = new Date(end);
  const now = new Date();

  if (newStart <= now) {
    throw new AppError('Counter proposal time must be in the future', 400, 'PAST_SLOT_NOT_ALLOWED');
  }

  const durationMin = (newEnd.getTime() - newStart.getTime()) / (1000 * 60);
  if (durationMin < 30 || durationMin > 180) {
    throw new AppError('Counter session duration must be between 30 and 180 minutes', 400, 'INVALID_DURATION');
  }

  // Conflict check for both participants
  const userAConflict = await hasAcceptedConflict(session.partner, newStart, newEnd);
  if (userAConflict) {
    throw new AppError('You have an accepted session during the new time slot', 409, 'SESSION_CONFLICT');
  }

  const userBConflict = await hasAcceptedConflict(session.proposer, newStart, newEnd);
  if (userBConflict) {
    throw new AppError('Partner has an accepted session during the new time slot', 409, 'SESSION_CONFLICT');
  }

  // Mark original session as countered
  const original = await Session.findOneAndUpdate(
    { _id: sessionId, status: 'proposed' },
    {
      $set: { status: 'countered' },
      $push: {
        history: {
          status: 'countered',
          by: userId,
          at: new Date(),
          note: 'Counter proposal initiated with new time',
        },
      },
    },
    { new: true }
  );

  if (!original) {
    throw new AppError('Session was updated concurrently', 409, 'CONCURRENT_CONFLICT');
  }

  // Create new session in 'proposed' directed to original proposer
  const expiresAt = new Date(Math.min(newStart.getTime(), Date.now() + 48 * 60 * 60 * 1000));

  const counterProposal = await Session.create({
    proposer: session.partner,
    partner: session.proposer,
    start: newStart,
    end: newEnd,
    topics: {
      proposerTeaches: session.topics.partnerTeaches,
      partnerTeaches: session.topics.proposerTeaches,
    },
    status: 'proposed',
    counterOf: session._id,
    expiresAt,
    history: [
      {
        status: 'proposed',
        by: userId,
        at: new Date(),
        note: `Countered previous proposal (${session._id})`,
      },
    ],
  });

  return { original, counterProposal };
};

/**
 * Cancels a session. Allowed by either party for 'proposed' or 'accepted' (before start).
 */
const cancelSession = async (sessionId, userId) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  const isParticipant =
    session.proposer.toString() === userId.toString() ||
    session.partner.toString() === userId.toString();

  if (!isParticipant) {
    throw new AppError('You are not authorized to cancel this session', 403, 'FORBIDDEN');
  }

  if (!['proposed', 'accepted'].includes(session.status)) {
    throw new AppError(
      `Cannot cancel session with status '${session.status}'. Legal transitions: proposed/accepted -> cancelled`,
      409,
      'ILLEGAL_TRANSITION'
    );
  }

  if (session.status === 'accepted') {
    if (new Date().getTime() >= new Date(session.start).getTime()) {
      throw new AppError('Cannot cancel an accepted session after its start time has passed', 400, 'CANNOT_CANCEL_STARTED_SESSION');
    }
  }

  const updated = await Session.findOneAndUpdate(
    { _id: sessionId, status: session.status },
    {
      $set: { status: 'cancelled' },
      $push: {
        history: {
          status: 'cancelled',
          by: userId,
          at: new Date(),
          note: 'Session cancelled by participant',
        },
      },
    },
    { new: true }
  );

  return updated;
};

/**
 * Confirms completion of session. Transitions to 'completed' only when BOTH confirm.
 */
const completeSession = async (sessionId, userId) => {
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
  }

  const isProposer = session.proposer.toString() === userId.toString();
  const isPartner = session.partner.toString() === userId.toString();

  if (!isProposer && !isPartner) {
    throw new AppError('You are not authorized to complete this session', 403, 'FORBIDDEN');
  }

  if (!['accepted', 'completed'].includes(session.status)) {
    throw new AppError(
      `Cannot complete session with status '${session.status}'. Must be accepted.`,
      409,
      'ILLEGAL_TRANSITION'
    );
  }

  // Must be after end time
  if (new Date().getTime() < new Date(session.end).getTime()) {
    throw new AppError('Cannot confirm completion before the session end time has passed', 400, 'SESSION_NOT_ENDED');
  }

  const completion = {
    proposer: session.completion?.proposer || false,
    partner: session.completion?.partner || false,
  };

  if (isProposer) completion.proposer = true;
  if (isPartner) completion.partner = true;

  const bothCompleted = completion.proposer && completion.partner;
  const newStatus = bothCompleted ? 'completed' : session.status;

  const updateFields = {
    completion,
    status: newStatus,
  };

  const pushFields = {};
  if (bothCompleted && session.status !== 'completed') {
    pushFields.history = {
      status: 'completed',
      by: userId,
      at: new Date(),
      note: 'Both participants confirmed completion',
    };
  }

  const updated = await Session.findByIdAndUpdate(
    sessionId,
    {
      $set: updateFields,
      ...(Object.keys(pushFields).length > 0 ? { $push: pushFields } : {}),
    },
    { new: true }
  )
    .populate('proposer', 'name email timezone reputation')
    .populate('partner', 'name email timezone reputation')
    .populate('topics.proposerTeaches')
    .populate('topics.partnerTeaches');

  return updated;
};

module.exports = {
  hasAcceptedConflict,
  proposeSession,
  acceptSession,
  declineSession,
  counterSession,
  cancelSession,
  completeSession,
};
