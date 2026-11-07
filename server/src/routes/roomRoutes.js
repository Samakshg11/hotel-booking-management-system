const express = require('express');
const { z } = require('zod');
const roomController = require('../controllers/roomController');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

const roomSchema = z.object({
  roomNumber: z.string().min(1, 'Room number is required'),
  roomTypeId: z.string().min(1, 'Room type ID is required'),
  floor: z.number().int(),
  status: z.enum(['available', 'maintenance', 'out_of_service']).optional(),
});

const statusSchema = z.object({
  status: z.enum(['available', 'maintenance', 'out_of_service']),
});

// GET /api/v1/rooms (Staff & Admin read)
router.get('/', authenticate, authorize('staff', 'admin'), roomController.getRooms);

// GET /api/v1/rooms/:id (Staff & Admin read)
router.get('/:id', authenticate, authorize('staff', 'admin'), roomController.getRoomById);

// POST /api/v1/rooms (Admin write)
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: roomSchema }),
  roomController.createRoom
);

// PATCH /api/v1/rooms/:id (Admin write)
router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ body: roomSchema.partial() }),
  roomController.updateRoom
);

// PATCH /api/v1/rooms/:id/status (Staff & Admin update housekeeping/maintenance status)
router.patch(
  '/:id/status',
  authenticate,
  authorize('staff', 'admin'),
  validate({ body: statusSchema }),
  roomController.updateRoomStatus
);

module.exports = router;

