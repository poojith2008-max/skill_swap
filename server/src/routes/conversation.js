const express = require('express');
const { z } = require('zod');
const {
  getConversations,
  createOrGetConversation,
  getMessages,
  sendMessageREST,
} = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');
const { validate, objectIdSchema } = require('../middleware/validate');
const { messageLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const createConversationSchema = z.object({
  recipientId: objectIdSchema,
});

const sendMessageSchema = z.object({
  text: z.string().min(1, 'Message cannot be empty').max(1000, 'Message cannot exceed 1000 characters'),
});

const idParamSchema = z.object({
  id: objectIdSchema,
});

const getMessagesQuerySchema = z.object({
  before: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.use(authMiddleware);

router.get('/', getConversations);
router.post('/', validate({ body: createConversationSchema }), createOrGetConversation);
router.get('/:id/messages', validate({ params: idParamSchema, query: getMessagesQuerySchema }), getMessages);
router.post('/:id/messages', messageLimiter, validate({ params: idParamSchema, body: sendMessageSchema }), sendMessageREST);

module.exports = router;
