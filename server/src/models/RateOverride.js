const mongoose = require('mongoose');

const rateOverrideSchema = new mongoose.Schema(
  {
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType',
      required: [true, 'Room type is required'],
      index: true,
    },
    startDate: {
      type: String, // YYYY-MM-DD
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: String, // YYYY-MM-DD
      required: [true, 'End date is required'],
    },
    rate: {
      type: Number, // paise
      required: [true, 'Override rate in paise is required'],
      min: [0, 'Rate cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

rateOverrideSchema.index({ roomTypeId: 1, startDate: 1, endDate: 1 });

rateOverrideSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('RateOverride', rateOverrideSchema);

