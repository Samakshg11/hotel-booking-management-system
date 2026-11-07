const authService = require('../services/authService');

/**
 * Guest Registration Controller
 */
async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;
    const result = await authService.registerGuest({ name, email, password, phone });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * User Login Controller
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

/**
 * Get Current Profile Controller
 */
async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    res.status(200).json({ data: { user } });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  getMe,
};

