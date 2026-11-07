const express = require('express');
const { z } = require('zod');
const adminController = require('../controllers/adminController');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(authenticate, authorize('admin'));

const roleSchema = z.object({
  role: z.enum(['guest', 'staff', 'admin']),
});

// PATCH /api/v1/admin/users/:id/role
router.patch('/users/:id/role', validate({ body: roleSchema }), adminController.updateUserRole);

module.exports = router;
