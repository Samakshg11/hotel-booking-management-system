const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: [true, 'Booking reference is required'],
      unique: true,
      trim: true,
    },
    guestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Guest ID is required'],
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room ID is required'],
      index: true,
    },
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType',
      required: [true, 'Room Type ID is required'],
      index: true,
    },
    checkIn: {
      type: String, // YYYY-MM-DD
      required: [true, 'Check-in date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    checkOut: {
      type: String, // YYYY-MM-DD
      required: [true, 'Check-out date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'],
    },
    nights: {
      type: Number,
      required: [true, 'Nights count is required'],
      min: [1, 'Must book at least 1 night'],
      max: [30, 'Cannot exceed 30 nights'],
    },
    guests: {
      type: Number,
      required: [true, 'Guests count is required'],
      min: [1, 'Must have at least 1 guest'],
    },
    status: {
      type: String,
      enum: ['HELD', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'EXPIRED'],
      default: 'HELD',
      required: true,
      index: true,
    },
    guestDetails: {
      fullName: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      phone: { type: String, default: '' },
    },
    price: {
      nightly: [
        {
          date: { type: String, required: true },
          rate: { type: Number, required: true }, // paise
        },
      ],
      subtotal: { type: Number, required: true }, // paise
      taxRate: { type: Number, required: true, default: 0.12 },
      tax: { type: Number, required: true }, // paise
      fees: { type: Number, required: true, default: 0 }, // paise
      total: { type: Number, required: true }, // paise
    },
    holdExpiresAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes declared explicitly as required by Section 5:
bookingSchema.index({ guestId: 1, createdAt: -1 });
bookingSchema.index({ status: 1, checkIn: 1 });
bookingSchema.index({ status: 1, checkOut: 1 });

bookingSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Booking', bookingSchema);
