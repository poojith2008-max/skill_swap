const express = require('express');
const { z } = require('zod');
const { getUserById, updateMe, updateMyAvailability } = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const { validate, objectIdSchema } = require('../middleware/validate');

const router = express.Router();

const updateMeSchema = z.object({
  bio: z.string().max(500).optional(),
  timezone: z.string().optional(),
  skillsOffered: z.array(z.any()).optional(),
  skillsWanted: z.array(z.any()).optional(),
});

const availabilitySchema = z.object({
  availability: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      startMin: z.number().int().min(0).max(1440),
      endMin: z.number().int().min(0).max(1440),
    })
  ),
});

const idParamSchema = z.object({
  id: objectIdSchema,
});

router.get('/me', authMiddleware, (req, res) => {
  res.status(200).json({ user: req.user });
});

router.put('/me', authMiddleware, validate({ body: updateMeSchema }), updateMe);
router.put('/me/availability', authMiddleware, validate({ body: availabilitySchema }), updateMyAvailability);
router.get('/:id', validate({ params: idParamSchema }), getUserById);
router.get('/:id/reviews', validate({ params: idParamSchema }), require('../controllers/reviewController').getUserReviews);

module.exports = router;
