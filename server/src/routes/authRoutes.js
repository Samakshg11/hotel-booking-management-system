const express = require('express');
const { z } = require('zod');
const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please provide a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Please provide a valid email'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/v1/auth/register (Guest self-registration)
router.post('/register', authLimiter, validate({ body: registerSchema }), authController.register);

// POST /api/v1/auth/login
router.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);

// GET /api/v1/auth/me (Protected)
router.get('/me', authenticate, authController.getMe);

module.exports = router;

