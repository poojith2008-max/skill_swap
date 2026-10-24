const Session = require('../models/Session');
const AppError = require('../utils/AppError');
const {
  proposeSession,
  acceptSession,
  declineSession,
  counterSession,
  cancelSession,
  completeSession,
} = require('../services/sessions');
const { findOrCreateConversation } = require('../services/chatService');

const createSessionHandler = async (req, res, next) => {
  try {
    const { partnerId, start, end, topics } = req.body;
    const session = await proposeSession(req.user._id, { partnerId, start, end, topics });

    const populated = await Session.findById(session._id)
      .populate('proposer', 'name email timezone reputation')
      .populate('partner', 'name email timezone reputation')
      .populate('topics.proposerTeaches')
      .populate('topics.partnerTeaches');

    res.status(201).json({
      message: 'Session proposal created successfully',
      session: populated,
    });
  } catch (error) {
    next(error);
  }
};

const getSessionsHandler = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { status, role } = req.query;

    const query = {};

    if (role === 'proposer') {
      query.proposer = userId;
    } else if (role === 'partner') {
      query.partner = userId;
    } else {
      query.$or = [{ proposer: userId }, { partner: userId }];
    }

    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    }

    const sessions = await Session.find(query)
      .populate('proposer', 'name email timezone reputation')
      .populate('partner', 'name email timezone reputation')
      .populate('topics.proposerTeaches')
      .populate('topics.partnerTeaches')
      .sort({ start: 1 });

    res.status(200).json({
      sessions,
      count: sessions.length,
    });
  } catch (error) {
    next(error);
  }
};

const getSessionByIdHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await Session.findById(id)
      .populate('proposer', 'name email timezone reputation')
      .populate('partner', 'name email timezone reputation')
      .populate('topics.proposerTeaches')
      .populate('topics.partnerTeaches')
      .populate('history.by', 'name email');

    if (!session) {
      return next(new AppError('Session not found', 404, 'SESSION_NOT_FOUND'));
    }

    const userIdStr = req.user._id.toString();
    const isParticipant =
      session.proposer._id.toString() === userIdStr ||
      session.partner._id.toString() === userIdStr;

    if (!isParticipant) {
      return next(new AppError('You are not authorized to view this session', 403, 'FORBIDDEN'));
    }

    res.status(200).json({ session });
  } catch (error) {
    next(error);
  }
};

const acceptSessionHandler = async (req, res, next) => {
  try {
    const session = await acceptSession(req.params.id, req.user._id);

    // Auto-provision conversation between proposer and partner so they can text immediately
    let conversationId = null;
    try {
      const conv = await findOrCreateConversation(session.proposer._id, session.partner._id);
      conversationId = conv._id;
    } catch (chatErr) {
      // Non-fatal if conversation already exists or warning
    }

    res.status(200).json({
      message: 'Session accepted successfully',
      session,
      conversationId,
    });
  } catch (error) {
    next(error);
  }
};

const declineSessionHandler = async (req, res, next) => {
  try {
    const session = await declineSession(req.params.id, req.user._id);
    res.status(200).json({
      message: 'Session declined successfully',
      session,
    });
  } catch (error) {
    next(error);
  }
};

const counterSessionHandler = async (req, res, next) => {
  try {
    const { start, end } = req.body;
    const result = await counterSession(req.params.id, req.user._id, { start, end });

    const populatedCounter = await Session.findById(result.counterProposal._id)
      .populate('proposer', 'name email timezone reputation')
      .populate('partner', 'name email timezone reputation')
      .populate('topics.proposerTeaches')
      .populate('topics.partnerTeaches');

    res.status(201).json({
      message: 'Counter proposal submitted successfully',
      original: result.original,
      session: populatedCounter,
    });
  } catch (error) {
    next(error);
  }
};

const cancelSessionHandler = async (req, res, next) => {
  try {
    const session = await cancelSession(req.params.id, req.user._id);
    res.status(200).json({
      message: 'Session cancelled successfully',
      session,
    });
  } catch (error) {
    next(error);
  }
};

const completeSessionHandler = async (req, res, next) => {
  try {
    const session = await completeSession(req.params.id, req.user._id);
    res.status(200).json({
      message: session.status === 'completed'
        ? 'Session successfully completed!'
        : 'Session completion confirmed by you. Waiting for partner confirmation.',
      session,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createSessionHandler,
  getSessionsHandler,
  getSessionByIdHandler,
  acceptSessionHandler,
  declineSessionHandler,
  counterSessionHandler,
  cancelSessionHandler,
  completeSessionHandler,
};
