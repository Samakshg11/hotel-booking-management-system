const express = require('express');
const { z } = require('zod');
const roomController = require('../controllers/roomController');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

const roomTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  capacity: z.number().int().min(1, 'Capacity must be at least 1'),
  amenities: z.array(z.string()).optional(),
  baseRate: z.number().int().min(0, 'Base rate in paise must be non-negative'),
  isActive: z.boolean().optional(),
});

// GET /api/v1/room-types (Public read)
router.get('/', roomController.getRoomTypes);

// GET /api/v1/room-types/:id (Public read)
router.get('/:id', roomController.getRoomTypeById);

// POST /api/v1/room-types (Admin write)
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate({ body: roomTypeSchema }),
  roomController.createRoomType
);

// PATCH /api/v1/room-types/:id (Admin write)
router.patch(
  '/:id',
  authenticate,
  authorize('admin'),
  validate({ body: roomTypeSchema.partial() }),
  roomController.updateRoomType
);

// DELETE /api/v1/room-types/:id (Admin write)
router.delete('/:id', authenticate, authorize('admin'), roomController.deleteRoomType);

module.exports = router;

