const express = require('express');
const reportController = require('../controllers/reportController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate);

// Staff and Admin: Arrivals and Departures
router.get('/arrivals', authorize('staff', 'admin'), reportController.getArrivals);
router.get('/departures', authorize('staff', 'admin'), reportController.getDepartures);

// Admin only: Financial summary & Daily revenue
router.get('/summary', authorize('admin'), reportController.getSummary);
router.get('/revenue-by-day', authorize('admin'), reportController.getRevenueByDay);

module.exports = router;
