const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      index: true,
    },
    amount: {
      type: Number, // paise
      required: [true, 'Amount is required'],
    },
    status: {
      type: String,
      enum: ['SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'],
      required: true,
      index: true,
    },
    method: {
      type: String,
      default: 'SANDBOX',
      required: true,
    },
    providerRef: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('Payment', paymentSchema);

