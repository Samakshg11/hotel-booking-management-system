const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter (100 requests per 15 minutes)
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again after 15 minutes',
        details: null,
      },
    });
  },
});

/**
 * Strict auth rate limiter (e.g. 20 requests per 15 minutes)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts, please try again after 15 minutes',
        details: null,
      },
    });
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
};
