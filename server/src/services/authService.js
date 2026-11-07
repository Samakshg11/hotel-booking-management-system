const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { ConflictError, UnauthorizedError, NotFoundError } = require('../utils/errors');

/**
 * Generates signed JWT token for user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

/**
 * Registers a new guest account
 */
async function registerGuest({ name, email, password, phone }) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ConflictError('A user with this email address already exists', 'EMAIL_ALREADY_EXISTS');
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    role: 'guest', // Self-registration is restricted to guest role
    phone: phone || '',
  });

  const token = generateToken(user);
  return { user: user.toJSON(), token };
}

/**
 * Authenticates user credentials and returns JWT token
 */
async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = generateToken(user);
  return { user: user.toJSON(), token };
}

/**
 * Retrieves current user profile
 */
async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user.toJSON();
}

module.exports = {
  generateToken,
  registerGuest,
  login,
  getMe,
};

