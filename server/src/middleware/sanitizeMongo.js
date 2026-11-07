/**
 * Middleware to sanitize MongoDB operator injection.
 * Rejects requests if any key in body, query, or params starts with '$' or contains '.'
 */
function sanitizeMongo(req, res, next) {
  const hasMongoOperator = (obj) => {
    if (!obj || typeof obj !== 'object') return false;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        return true;
      }
      if (typeof obj[key] === 'object' && hasMongoOperator(obj[key])) {
        return true;
      }
    }
    return false;
  };

  if (hasMongoOperator(req.body) || hasMongoOperator(req.query) || hasMongoOperator(req.params)) {
    return res.status(400).json({
      error: {
        code: 'PROHIBITED_CHARACTERS',
        message: 'Request contains prohibited characters ($ or .) in key names',
        details: null,
      },
    });
  }

  next();
}

module.exports = sanitizeMongo;
