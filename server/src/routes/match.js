const express = require('express');
const { z } = require('zod');
const { getMatchesHandler } = require('../controllers/matchController');
const authMiddleware = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get('/', authMiddleware, validate({ query: querySchema }), getMatchesHandler);

module.exports = router;
