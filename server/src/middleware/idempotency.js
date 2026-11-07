const crypto = require('crypto');
const IdempotencyKey = require('../models/IdempotencyKey');
const { BadRequestError, UnprocessableEntityError } = require('../utils/errors');
const logger = require('../config/logger');

/**
 * Middleware enforcing Idempotency-Key on mutating endpoints
 * @param {boolean} required - whether the header is strictly required
 */
function idempotency(required = true) {
  return async (req, res, next) => {
    const key = req.headers['idempotency-key'];

    if (!key) {
      if (required) {
        return next(new BadRequestError('Idempotency-Key header is required for this operation'));
      }
      return next();
    }

    if (!req.user) {
      return next(new BadRequestError('Authenticated user required for idempotent operations'));
    }

    const payloadString = JSON.stringify(req.body || {});
    const requestHash = crypto.createHash('sha256').update(payloadString).digest('hex');

    try {
      const existing = await IdempotencyKey.findOne({ key, userId: req.user.id });

      if (existing) {
        if (existing.requestHash === requestHash) {
          logger.info({ key, userId: req.user.id }, 'Returning cached idempotent response');
          return res.status(existing.responseStatus).json(existing.responseBody);
        } else {
          logger.warn({ key, userId: req.user.id }, 'Idempotency key reused with mismatched payload');
          return next(
            new UnprocessableEntityError(
              'Idempotency key has already been used with a different request payload',
              'IDEMPOTENCY_KEY_REUSED'
            )
          );
        }
      }

      // Intercept res.json to cache response upon completion
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        // Only cache successful or client-error responses, not server failures
        if (res.statusCode < 500) {
          IdempotencyKey.create({
            key,
            userId: req.user.id,
            requestHash,
            responseStatus: res.statusCode,
            responseBody: body,
          }).catch((err) => {
            logger.error({ err, key }, 'Failed to persist idempotency key');
          });
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = idempotency;
