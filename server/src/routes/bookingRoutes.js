const express = require('express');
const { z } = require('zod');
const bookingController = require('../controllers/bookingController');
const frontDeskController = require('../controllers/frontDeskController');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const idempotency = require('../middleware/idempotency');

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

const confirmSchema = z.object({
  cardNumber: z.string().min(4, 'Card number is required'),
});

const cancelSchema = z.object({
  reason: z.string().optional(),
});

// GET /api/v1/bookings (Staff & Admin: filter by status, date range, reference, guest email; paginated)
router.get('/', authenticate, authorize('staff', 'admin'), frontDeskController.listBookings);

// GET /api/v1/bookings/mine (Guest history)
router.get('/mine', authenticate, bookingController.getMyBookings);

// GET /api/v1/bookings/:id (Caller must own booking, or be staff/admin)
router.get('/:id', authenticate, bookingController.getBookingById);

// POST /api/v1/bookings/hold (Authenticated: guest, staff, admin)
router.post('/hold', authenticate, validate({ body: holdSchema }), bookingController.holdBooking);

// POST /api/v1/bookings/:id/confirm (Requires Idempotency-Key header)
router.post(
  '/:id/confirm',
  authenticate,
  idempotency(true),
  validate({ body: confirmSchema }),
  bookingController.confirmBooking
);

// POST /api/v1/bookings/:id/cancel
router.post(
  '/:id/cancel',
  authenticate,
  validate({ body: cancelSchema }),
  bookingController.cancelBooking
);

// POST /api/v1/bookings/:id/check-in (Staff & Admin only)
router.post('/:id/check-in', authenticate, authorize('staff', 'admin'), frontDeskController.checkIn);

// POST /api/v1/bookings/:id/check-out (Staff & Admin only)
router.post('/:id/check-out', authenticate, authorize('staff', 'admin'), frontDeskController.checkOut);

module.exports = router;
