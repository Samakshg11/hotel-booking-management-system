const express = require('express');
const { z } = require('zod');
const availabilityController = require('../controllers/availabilityController');
const validate = require('../middleware/validate');

const router = express.Router();

const availabilityQuerySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkIn must be in YYYY-MM-DD format'),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'checkOut must be in YYYY-MM-DD format'),
  guests: z.coerce.number().int().min(1).optional(),
  roomTypeId: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

// GET /api/v1/availability (Public search)
router.get('/', validate({ query: availabilityQuerySchema }), availabilityController.getAvailability);

module.exports = router;
