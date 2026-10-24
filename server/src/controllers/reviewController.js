const Review = require('../models/Review');
const Session = require('../models/Session');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { updateUserReputation } = require('../services/reputation');
const { createNotification } = require('../services/notificationService');

const createReview = async (req, res, next) => {
  try {
    const { sessionId, rating, comment } = req.body;
    const reviewerId = req.user._id;

    const session = await Session.findById(sessionId);
    if (!session) {
      return next(new AppError('Session not found', 404, 'SESSION_NOT_FOUND'));
    }

    if (session.status !== 'completed') {
      return next(
        new AppError(
          'Reviews can only be submitted after a session has been successfully completed by both participants',
          400,
          'SESSION_NOT_COMPLETED'
        )
      );
    }

    const isProposer = session.proposer.toString() === reviewerId.toString();
    const isPartner = session.partner.toString() === reviewerId.toString();

    if (!isProposer && !isPartner) {
      return next(new AppError('You are not a participant of this session', 403, 'FORBIDDEN'));
    }

    const revieweeId = isProposer ? session.partner : session.proposer;

    if (reviewerId.toString() === revieweeId.toString()) {
      return next(new AppError('You cannot review yourself', 400, 'SELF_REVIEW_NOT_ALLOWED'));
    }

    // Check for duplicate review
    const existingReview = await Review.findOne({
      session: sessionId,
      reviewer: reviewerId,
    });

    if (existingReview) {
      return next(new AppError('You have already submitted a review for this session', 409, 'DUPLICATE_REVIEW'));
    }

    const review = await Review.create({
      session: sessionId,
      reviewer: reviewerId,
      reviewee: revieweeId,
      rating,
      comment: comment || '',
    });

    // Recompute reviewee Bayesian reputation
    const newReputation = await updateUserReputation(revieweeId);

    // Notify reviewee
    await createNotification({
      recipient: revieweeId,
      type: 'new_review',
      title: 'New Review Received',
      message: `${req.user.name} gave you a ${rating}-star review: "${comment ? comment.substring(0, 60) : 'Great session!'}"`,
      data: {
        sessionId: session._id,
        reviewId: review._id,
      },
    });

    res.status(201).json({
      message: 'Review submitted successfully',
      review,
      revieweeReputation: newReputation,
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new AppError('You have already reviewed this session', 409, 'DUPLICATE_REVIEW'));
    }
    next(error);
  }
};

const getUserReviews = async (req, res, next) => {
  try {
    const { id } = req.params;

    const targetUser = await User.findById(id).select('name reputation bio');
    if (!targetUser) {
      return next(new AppError('User not found', 404, 'USER_NOT_FOUND'));
    }

    const reviews = await Review.find({ reviewee: id })
      .populate('reviewer', 'name reputation')
      .populate({
        path: 'session',
        populate: [
          { path: 'topics.proposerTeaches', select: 'name' },
          { path: 'topics.partnerTeaches', select: 'name' },
        ],
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      reviews,
      count: reviews.length,
      user: targetUser,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createReview,
  getUserReviews,
};
