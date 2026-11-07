const express = require('express');
const { z } = require('zod');
const bookingController = require('../controllers/bookingController');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

const holdSchema = z.object({
  roomTypeId: z.string().min(1, 'roomTypeId is required'),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be YYYY-MM-DD'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be YYYY-MM-DD'),
  guests: z.number().int().min(1, 'guests must be at least 1'),
  guestDetails: z
    .object({
      fullName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

// POST /api/v1/bookings/hold (Authenticated: guest, staff, admin)
router.post('/hold', authenticate, validate({ body: holdSchema }), bookingController.holdBooking);

module.exports = router;
