const mongoose = require('mongoose');
const logger = require('./logger');

/**
 * Connect to MongoDB with replica set support (required for transactions)
 */
async function connectDB(uri) {
  const mongoUri = uri || process.env.MONGODB_URI;

  try {
    const conn = await mongoose.connect(mongoUri, {
      autoIndex: true, // Build indexes on startup
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection failed');
    throw error;
  }
}

/**
 * Disconnect from MongoDB gracefully
 */
async function disconnectDB() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

module.exports = {
  connectDB,
  disconnectDB,
};
