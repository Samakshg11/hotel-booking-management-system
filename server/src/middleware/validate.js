const { BadRequestError } = require('../utils/errors');

/**
 * Zod validation middleware factory.
 * Accepts optional Zod schemas for body, query, and params.
 */
function validate({ body, query, params }) {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }
      if (query) {
        req.query = query.parse(req.query);
      }
      if (params) {
        req.params = params.parse(req.params);
      }
      next();
    } catch (err) {
      if (err.errors) {
        const details = err.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(new BadRequestError('Validation failed', details, 'VALIDATION_ERROR'));
      }
      next(err);
    }
  };
}

module.exports = validate;
