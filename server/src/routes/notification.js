const express = require('express');
const { z } = require('zod');
const {
  getNotifications,
  markNotificationRead,
  markAllRead,
} = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');
const { validate, objectIdSchema } = require('../middleware/validate');

const router = express.Router();

const idParamSchema = z.object({
  id: objectIdSchema,
});

router.use(authMiddleware);

router.get('/', getNotifications);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', validate({ params: idParamSchema }), markNotificationRead);

module.exports = router;
