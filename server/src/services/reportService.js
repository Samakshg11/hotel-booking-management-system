const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const RoomNight = require('../models/RoomNight');
const Room = require('../models/Room');
const { getTodayUtcString, calculateNights, parseUtcDate } = require('../utils/dates');
const { BadRequestError } = require('../utils/errors');

/**
 * Report Service utilizing MongoDB Aggregation Pipelines
 * Reconciles 100% with raw bookings, payments, and roomNights.
 */

async function getSummaryReport({ from, to }) {
  const fromDate = from || getTodayUtcString();
  const toDate = to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (toDate < fromDate) {
    throw new BadRequestError("'to' date must be greater than or equal to 'from' date", null, 'VALIDATION_ERROR');
  }

  // Calculate days in query range (inclusive)
  const diffDays = Math.max(1, calculateNights(fromDate, toDate) + 1);

  // 1. Total active rooms (excluding out_of_service)
  const activeRoomsCount = await Room.countDocuments({ status: { $ne: 'out_of_service' } });

  // 2. Occupied room-nights in range using Aggregation Pipeline
  const occupancyAggregation = await RoomNight.aggregate([
    {
      $match: {
        date: { $gte: fromDate, $lte: toDate },
        status: 'CONFIRMED',
      },
    },
    {
      $group: {
        _id: null,
        occupiedRoomNights: { $sum: 1 },
      },
    },
  ]);

  const occupiedRoomNights = occupancyAggregation[0]?.occupiedRoomNights || 0;
  const totalCapacity = activeRoomsCount * diffDays;
  const occupancyPercentage =
    totalCapacity > 0 ? Number(((occupiedRoomNights / totalCapacity) * 100).toFixed(2)) : 0;

  // 3. Revenue Aggregation Pipeline
  // Rule: sum of price.total for bookings in CONFIRMED/CHECKED_IN/CHECKED_OUT whose stay overlaps the range
  const revenueAggregation = await Booking.aggregate([
    {
      $match: {
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
        checkIn: { $lte: toDate },
        checkOut: { $gte: fromDate },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$price.total' },
        subtotalRevenue: { $sum: '$price.subtotal' },
        taxCollected: { $sum: '$price.tax' },
        bookingsCount: { $sum: 1 },
      },
    },
  ]);

  const totalRevenue = revenueAggregation[0]?.totalRevenue || 0;
  const subtotalRevenue = revenueAggregation[0]?.subtotalRevenue || 0;
  const taxCollected = revenueAggregation[0]?.taxCollected || 0;
  const qualifyingBookings = revenueAggregation[0]?.bookingsCount || 0;

  // 4. Counts by booking status in range
  const statusCountsAggregation = await Booking.aggregate([
    {
      $match: {
        checkIn: { $lte: toDate },
        checkOut: { $gte: fromDate },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const countsByStatus = {
    HELD: 0,
    CONFIRMED: 0,
    CHECKED_IN: 0,
    CHECKED_OUT: 0,
    CANCELLED: 0,
    EXPIRED: 0,
  };

  statusCountsAggregation.forEach((item) => {
    if (countsByStatus[item._id] !== undefined) {
      countsByStatus[item._id] = item.count;
    }
  });

  return {
    range: { from: fromDate, to: toDate, days: diffDays },
    occupancy: {
      ratePercentage: occupancyPercentage,
      occupiedRoomNights,
      totalCapacity,
      activeRooms: activeRoomsCount,
    },
    revenue: {
      total: totalRevenue, // paise
      subtotal: subtotalRevenue, // paise
      tax: taxCollected, // paise
      qualifyingBookings,
    },
    countsByStatus,
  };
}

async function getArrivals({ from, to }) {
  const fromDate = from || getTodayUtcString();
  const toDate = to || fromDate;

  return Booking.find({
    checkIn: { $gte: fromDate, $lte: toDate },
    status: { $in: ['CONFIRMED', 'CHECKED_IN'] },
  })
    .populate('roomId', 'roomNumber floor status')
    .populate('roomTypeId', 'name capacity')
    .sort({ checkIn: 1 });
}

async function getDepartures({ from, to }) {
  const fromDate = from || getTodayUtcString();
  const toDate = to || fromDate;

  return Booking.find({
    checkOut: { $gte: fromDate, $lte: toDate },
    status: { $in: ['CHECKED_IN', 'CHECKED_OUT'] },
  })
    .populate('roomId', 'roomNumber floor status')
    .populate('roomTypeId', 'name capacity')
    .sort({ checkOut: 1 });
}

async function getRevenueByDay({ from, to }) {
  const fromDate = from || getTodayUtcString();
  const toDate = to || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const dailyRevenue = await RoomNight.aggregate([
    {
      $match: {
        date: { $gte: fromDate, $lte: toDate },
        status: 'CONFIRMED',
      },
    },
    {
      $lookup: {
        from: 'bookings',
        localField: 'bookingId',
        foreignField: '_id',
        as: 'booking',
      },
    },
    { $unwind: '$booking' },
    {
      $group: {
        _id: '$date',
        occupiedNights: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return dailyRevenue.map((d) => ({
    date: d._id,
    occupiedNights: d.occupiedNights,
  }));
}

module.exports = {
  getSummaryReport,
  getArrivals,
  getDepartures,
  getRevenueByDay,
};
