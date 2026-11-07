const AuditLog = require('../models/AuditLog');

/**
 * Audit Log Service (Admin only)
 */

async function listAuditLogs({ entityType, entityId, actorId, page = 1, limit = 20 }) {
  const query = {};

  if (entityType) query.entityType = entityType;
  if (entityId) query.entityId = entityId;
  if (actorId) query.actorId = actorId;

  const total = await AuditLog.countDocuments(query);
  const logs = await AuditLog.find(query)
    .populate('actorId', 'name email role')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return {
    data: logs,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
  };
}

module.exports = {
  listAuditLogs,
};
