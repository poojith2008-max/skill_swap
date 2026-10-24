const express = require('express');
const { z } = require('zod');
const {
  createSessionHandler,
  getSessionsHandler,
  getSessionByIdHandler,
  acceptSessionHandler,
  declineSessionHandler,
  counterSessionHandler,
  cancelSessionHandler,
  completeSessionHandler,
} = require('../controllers/sessionController');
const authMiddleware = require('../middleware/auth');
const { validate, objectIdSchema } = require('../middleware/validate');

const router = express.Router();

const createSessionSchema = z.object({
  partnerId: objectIdSchema,
  start: z.string().datetime({ message: 'Invalid start date format, expected ISO datetime' }),
  end: z.string().datetime({ message: 'Invalid end date format, expected ISO datetime' }),
  topics: z
    .object({
      proposerTeaches: objectIdSchema.nullable().optional(),
      partnerTeaches: objectIdSchema.nullable().optional(),
    })
    .optional(),
});

const counterSessionSchema = z.object({
  start: z.string().datetime({ message: 'Invalid start date format, expected ISO datetime' }),
  end: z.string().datetime({ message: 'Invalid end date format, expected ISO datetime' }),
});

const idParamSchema = z.object({
  id: objectIdSchema,
});

const getQuerySchema = z.object({
  status: z.string().optional(),
  role: z.enum(['proposer', 'partner', 'all']).optional(),
});

// All session routes require authentication
router.use(authMiddleware);

router.post('/', validate({ body: createSessionSchema }), createSessionHandler);
router.get('/', validate({ query: getQuerySchema }), getSessionsHandler);
router.get('/:id', validate({ params: idParamSchema }), getSessionByIdHandler);

router.patch('/:id/accept', validate({ params: idParamSchema }), acceptSessionHandler);
router.patch('/:id/decline', validate({ params: idParamSchema }), declineSessionHandler);
router.patch('/:id/counter', validate({ params: idParamSchema, body: counterSessionSchema }), counterSessionHandler);
router.patch('/:id/cancel', validate({ params: idParamSchema }), cancelSessionHandler);
router.patch('/:id/complete', validate({ params: idParamSchema }), completeSessionHandler);

module.exports = router;
