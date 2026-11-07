const roomService = require('../services/roomService');

/**
 * Room & Room Type Controller
 */

async function getRoomTypes(req, res, next) {
  try {
    const roomTypes = await roomService.listRoomTypes();
    res.status(200).json({ data: roomTypes });
  } catch (err) {
    next(err);
  }
}

async function getRoomTypeById(req, res, next) {
  try {
    const roomType = await roomService.getRoomTypeById(req.params.id);
    res.status(200).json({ data: roomType });
  } catch (err) {
    next(err);
  }
}

async function createRoomType(req, res, next) {
  try {
    const roomType = await roomService.createRoomType(req.body);
    res.status(201).json({ data: roomType });
  } catch (err) {
    next(err);
  }
}

async function updateRoomType(req, res, next) {
  try {
    const roomType = await roomService.updateRoomType(req.params.id, req.body);
    res.status(200).json({ data: roomType });
  } catch (err) {
    next(err);
  }
}

async function deleteRoomType(req, res, next) {
  try {
    const result = await roomService.deleteRoomType(req.params.id);
    res.status(200).json({ data: result });
  } catch (err) {
    next(err);
  }
}

async function getRooms(req, res, next) {
  try {
    const { roomTypeId, status, floor } = req.query;
    const rooms = await roomService.listRooms({ roomTypeId, status, floor });
    res.status(200).json({ data: rooms });
  } catch (err) {
    next(err);
  }
}

async function getRoomById(req, res, next) {
  try {
    const room = await roomService.getRoomById(req.params.id);
    res.status(200).json({ data: room });
  } catch (err) {
    next(err);
  }
}

async function createRoom(req, res, next) {
  try {
    const room = await roomService.createRoom(req.body);
    res.status(201).json({ data: room });
  } catch (err) {
    next(err);
  }
}

async function updateRoom(req, res, next) {
  try {
    const room = await roomService.updateRoom(req.params.id, req.body);
    res.status(200).json({ data: room });
  } catch (err) {
    next(err);
  }
}

async function updateRoomStatus(req, res, next) {
  try {
    const room = await roomService.updateRoomStatus(req.params.id, req.body.status);
    res.status(200).json({ data: room });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRoomTypes,
  getRoomTypeById,
  createRoomType,
  updateRoomType,
  deleteRoomType,
  getRooms,
  getRoomById,
  createRoom,
  updateRoom,
  updateRoomStatus,
};
