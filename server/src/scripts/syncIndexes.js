const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');
const RoomType = require('../models/RoomType');
const Room = require('../models/Room');
const RoomNight = require('../models/RoomNight');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const IdempotencyKey = require('../models/IdempotencyKey');
const RateOverride = require('../models/RateOverride');
const logger = require('../config/logger');

async function syncAllIndexes() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotel_management?replicaSet=rs0';
  logger.info({ mongoUri }, 'Connecting to MongoDB for index sync...');
  await mongoose.connect(mongoUri);

  const models = [
    User,
    RoomType,
    Room,
    RoomNight,
    Booking,
    Payment,
    AuditLog,
    IdempotencyKey,
    RateOverride,
  ];

  logger.info('Syncing indexes for all Mongoose models...');
  for (const model of models) {
    logger.info(`Syncing indexes for ${model.modelName}...`);
    await model.syncIndexes();
  }

  logger.info('All model indexes synced successfully!');
  await mongoose.disconnect();
}

if (require.main === module) {
  syncAllIndexes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error syncing indexes:', err);
      process.exit(1);
    });
}

module.exports = syncAllIndexes;

