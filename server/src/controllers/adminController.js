const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { NotFoundError, BadRequestError } = require('../utils/errors');

/**
 * Admin Role Management
 */
async function updateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['guest', 'staff', 'admin'];
    if (!validRoles.includes(role)) {
      throw new BadRequestError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const previousRole = user.role;
    user.role = role;
    await user.save();

    // Audit log
    await AuditLog.create({
      actorId: req.user.id,
      actorRole: req.user.role,
      action: 'USER_ROLE_CHANGE',
      entityType: 'User',
      entityId: user._id.toString(),
      before: { role: previousRole },
      after: { role },
      meta: { targetEmail: user.email },
    });

    res.status(200).json({ data: user.toJSON() });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  updateUserRole,
};
