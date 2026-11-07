const mongoose = require('mongoose');

const roomNightSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room is required'],
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD (UTC midnight semantics)
      required: [true, 'Date string is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['HELD', 'CONFIRMED'],
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// THE UNIQUE-INDEX TRICK: Guarantees at database-level that no room can have more than one reservation for the same night
roomNightSchema.index({ roomId: 1, date: 1 }, { unique: true });

// TTL index on expiresAt for cleanup only (lazy background cleanup; logic must not depend solely on it)
roomNightSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

roomNightSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('RoomNight', roomNightSchema);
