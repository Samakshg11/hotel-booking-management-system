const reportService = require('../services/reportService');

/**
 * Report Controller (Admin for summary/revenue; Staff & Admin for arrivals/departures)
 */

async function getSummary(req, res, next) {
  try {
    const { from, to } = req.query;
    const summary = await reportService.getSummaryReport({ from, to });
    res.status(200).json({ data: summary });
  } catch (error) {
    next(error);
  }
}

async function getArrivals(req, res, next) {
  try {
    const { from, to } = req.query;
    const arrivals = await reportService.getArrivals({ from, to });
    res.status(200).json({ data: arrivals });
  } catch (error) {
    next(error);
  }
}

async function getDepartures(req, res, next) {
  try {
    const { from, to } = req.query;
    const departures = await reportService.getDepartures({ from, to });
    res.status(200).json({ data: departures });
  } catch (error) {
    next(error);
  }
}

async function getRevenueByDay(req, res, next) {
  try {
    const { from, to } = req.query;
    const revenueByDay = await reportService.getRevenueByDay({ from, to });
    res.status(200).json({ data: revenueByDay });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSummary,
  getArrivals,
  getDepartures,
  getRevenueByDay,
};
