const express = require('express');
const guestController = require('../controllers/guestController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// Protected: Staff & Admin only
router.use(authenticate, authorize('staff', 'admin'));

// GET /api/v1/guests (Search & paginate)
router.get('/', guestController.getGuests);

// GET /api/v1/guests/:id (Guest profile with stay history)
router.get('/:id', guestController.getGuestById);

module.exports = router;

