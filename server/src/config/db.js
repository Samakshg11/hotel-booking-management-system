const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');

/**
 * Connect to MongoDB with replica set support (required for transactions)
 */
async function connectDB(uri) {
  const mongoUri = uri || env.MONGODB_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotel_management?replicaSet=rs0';

  try {
    const conn = await mongoose.connect(mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });

    const isReplicaSet = Boolean(conn.connection?.client?.topology?.description?.setName);
    logger.info(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name} (mode: ${isReplicaSet ? 'ReplicaSet rs0' : 'Standalone'})`);
    return conn;
  } catch (error) {
    // If replica set connection failed and replicaSet= was in URI, retry without it for local standalone instances
    if (mongoUri.includes('replicaSet=') && (error.name === 'MongooseServerSelectionError' || error.message?.includes('replicaSet') || error.message?.includes('timed out'))) {
      const fallbackUri = mongoUri.replace(/[?&]replicaSet=[^&]+/, '').replace(/\?$/, '');
      logger.warn(`Replica set 'rs0' not found on host. Falling back to standalone MongoDB at ${fallbackUri}...`);
      try {
        const conn = await mongoose.connect(fallbackUri, {
          autoIndex: true,
          serverSelectionTimeoutMS: 5000,
        });
        logger.info(`MongoDB Connected (mode: Standalone): ${conn.connection.host}/${conn.connection.name}`);
        return conn;
      } catch (fallbackError) {
        logger.error({ err: fallbackError }, 'MongoDB connection failed in both replica set and standalone modes');
        throw fallbackError;
      }
    }

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

