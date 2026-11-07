const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      unique: true,
      trim: true,
    },
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType',
      required: [true, 'Room type is required'],
      index: true,
    },
    floor: {
      type: Number,
      required: [true, 'Floor number is required'],
    },
    status: {
      type: String,
      enum: ['available', 'maintenance', 'out_of_service'],
      default: 'available',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index declared as required: rooms { roomTypeId, status }
roomSchema.index({ roomTypeId: 1, status: 1 });

roomSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Room', roomSchema);
