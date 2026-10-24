const express = require('express');
const { z } = require('zod');
const { createReview, getUserReviews } = require('../controllers/reviewController');
const authMiddleware = require('../middleware/auth');
const { validate, objectIdSchema } = require('../middleware/validate');

const router = express.Router();

const createReviewSchema = z.object({
  sessionId: objectIdSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

const idParamSchema = z.object({
  id: objectIdSchema,
});

router.post('/', authMiddleware, validate({ body: createReviewSchema }), createReview);

module.exports = {
  reviewRouter: router,
  getUserReviewsHandler: getUserReviews,
};
