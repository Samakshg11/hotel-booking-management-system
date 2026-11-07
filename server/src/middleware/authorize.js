const { ForbiddenError, UnauthorizedError } = require('../utils/errors');

/**
 * Role-Based Access Control (RBAC) middleware factory.
 * Enforces allowed roles strictly server-side.
 * @param  {...string} allowedRoles - e.g. 'staff', 'admin'
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required before authorization'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access forbidden: required role [${allowedRoles.join(', ')}], current role is [${req.user.role}]`
        )
      );
    }

    next();
  };
}

module.exports = authorize;
