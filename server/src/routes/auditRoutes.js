const express = require('express');
const auditController = require('../controllers/auditController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// Admin only
router.use(authenticate, authorize('admin'));

// GET /api/v1/audit-logs
router.get('/', auditController.getAuditLogs);

module.exports = router;

