const logger = require('../config/logger');
const { AppError } = require('../utils/errors');

/**
 * Centralized error handler enforcing consistent error envelope:
 * { "error": { "code": "...", "message": "...", "details": [...] } }
 * Never leaks stack traces in responses.
 */
function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected server error occurred';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    // Mongoose validation error
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.code === 11000) {
    // MongoDB duplicate key error
    statusCode = 409;
    code = 'DUPLICATE_KEY_ERROR';
    message = 'Resource already exists with unique field conflict';
    details = err.keyValue;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'UNAUTHENTICATED';
    message = 'Invalid or expired authentication token';
  }

  // Log error with Pino
  if (statusCode >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'Internal Server Error');
  } else {
    logger.warn({ code, message, path: req.path, method: req.method, statusCode }, 'Client Handled Error');
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      details,
    },
  });
}

module.exports = errorHandler;
