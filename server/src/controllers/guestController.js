const guestService = require('../services/guestService');

/**
 * Guest Controller (Staff & Admin)
 */

async function getGuests(req, res, next) {
  try {
    const { search, page, limit } = req.query;
    const result = await guestService.listGuests({
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
    res.status(200).json({ data: result.data, meta: result.meta });
  } catch (error) {
    next(error);
  }
}

async function getGuestById(req, res, next) {
  try {
    const result = await guestService.getGuestWithHistory(req.params.id);
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getGuests,
  getGuestById,
};
