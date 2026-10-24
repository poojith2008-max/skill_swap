const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const createRateLimiter = ({
  windowMs = env.RATE_LIMIT_WINDOW_MS,
  max = env.RATE_LIMIT_MAX,
  message = 'Too many requests from this IP, please try again later.',
  code = 'RATE_LIMIT_EXCEEDED',
} = {}) => {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code,
          message,
        },
      });
    },
    // Skip rate limiting in test environment
    skip: () => env.NODE_ENV === 'test',
  });
};

// General API rate limiter
const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many API requests, please slow down.',
});

// Stricter rate limiter for authentication routes (login/register)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many login or registration attempts, please try again in 15 minutes.',
  code: 'AUTH_RATE_LIMIT_EXCEEDED',
});

// Message endpoint rate limiter
const messageLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Too many messages sent. Please pause for a moment.',
  code: 'MESSAGE_RATE_LIMIT_EXCEEDED',
});

module.exports = {
  apiLimiter,
  authLimiter,
  messageLimiter,
};
