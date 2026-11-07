const auditService = require('../services/auditService');

/**
 * Audit Log Controller (Admin only)
 */

async function getAuditLogs(req, res, next) {
  try {
    const { entityType, entityId, actorId, page, limit } = req.query;
    const result = await auditService.listAuditLogs({
      entityType,
      entityId,
      actorId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
    res.status(200).json({ data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAuditLogs,
};
