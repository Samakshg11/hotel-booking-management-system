const RoomType = require('../models/RoomType');
const Room = require('../models/Room');
const { NotFoundError, ConflictError, BadRequestError } = require('../utils/errors');

/**
 * Room & Room Type Domain Service
 */

async function listRoomTypes(filter = {}) {
  return RoomType.find({ ...filter, isActive: true }).sort({ baseRate: 1 });
}

async function getRoomTypeById(id) {
  const roomType = await RoomType.findById(id);
  if (!roomType) {
    throw new NotFoundError('Room type not found');
  }
  return roomType;
}

async function createRoomType(data) {
  const existing = await RoomType.findOne({ name: data.name });
  if (existing) {
    throw new ConflictError('A room type with this name already exists', 'ROOM_TYPE_NAME_EXISTS');
  }
  return RoomType.create(data);
}

async function updateRoomType(id, updateData) {
  const roomType = await RoomType.findById(id);
  if (!roomType) {
    throw new NotFoundError('Room type not found');
  }

  if (updateData.name && updateData.name !== roomType.name) {
    const existing = await RoomType.findOne({ name: updateData.name });
    if (existing) {
      throw new ConflictError('A room type with this name already exists', 'ROOM_TYPE_NAME_EXISTS');
    }
  }

  Object.assign(roomType, updateData);
  await roomType.save();
  return roomType;
}

async function deleteRoomType(id) {
  const roomType = await RoomType.findById(id);
  if (!roomType) {
    throw new NotFoundError('Room type not found');
  }

  // Soft delete to preserve historical integrity
  roomType.isActive = false;
  await roomType.save();
  return { id, message: 'Room type deactivated successfully' };
}

async function listRooms(filter = {}) {
  const query = {};
  if (filter.roomTypeId) query.roomTypeId = filter.roomTypeId;
  if (filter.status) query.status = filter.status;
  if (filter.floor) query.floor = filter.floor;

  return Room.find(query).populate('roomTypeId').sort({ roomNumber: 1 });
}

async function getRoomById(id) {
  const room = await Room.findById(id).populate('roomTypeId');
  if (!room) {
    throw new NotFoundError('Room not found');
  }
  return room;
}

async function createRoom(data) {
  const existing = await Room.findOne({ roomNumber: data.roomNumber });
  if (existing) {
    throw new ConflictError(`Room number ${data.roomNumber} already exists`, 'ROOM_NUMBER_EXISTS');
  }

  // Verify room type exists
  const roomType = await RoomType.findById(data.roomTypeId);
  if (!roomType) {
    throw new BadRequestError('Invalid roomTypeId: Room type does not exist');
  }

  return Room.create(data);
}

async function updateRoom(id, updateData) {
  const room = await Room.findById(id);
  if (!room) {
    throw new NotFoundError('Room not found');
  }

  if (updateData.roomNumber && updateData.roomNumber !== room.roomNumber) {
    const existing = await Room.findOne({ roomNumber: updateData.roomNumber });
    if (existing) {
      throw new ConflictError(`Room number ${updateData.roomNumber} already exists`, 'ROOM_NUMBER_EXISTS');
    }
  }

  if (updateData.roomTypeId) {
    const roomType = await RoomType.findById(updateData.roomTypeId);
    if (!roomType) {
      throw new BadRequestError('Invalid roomTypeId: Room type does not exist');
    }
  }

  Object.assign(room, updateData);
  await room.save();
  return room.populate('roomTypeId');
}

async function updateRoomStatus(id, status) {
  const validStatuses = ['available', 'maintenance', 'out_of_service'];
  if (!validStatuses.includes(status)) {
    throw new BadRequestError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const room = await Room.findById(id);
  if (!room) {
    throw new NotFoundError('Room not found');
  }

  room.status = status;
  await room.save();
  return room.populate('roomTypeId');
}

module.exports = {
  listRoomTypes,
  getRoomTypeById,
  createRoomType,
  updateRoomType,
  deleteRoomType,
  listRooms,
  getRoomById,
  createRoom,
  updateRoom,
  updateRoomStatus,
};
