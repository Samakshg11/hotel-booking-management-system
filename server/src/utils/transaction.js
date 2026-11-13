const mongoose = require('mongoose');

/**
 * Executes a callback within a MongoDB multi-document ACID transaction if a replica set is active.
 * If connected to a standalone local MongoDB instance (where transactions are not supported),
 * safely executes operations directly without a session.
 *
 * @param {Function} callback - Async function receiving (session | null)
 * @returns {*} The result of the callback
 */
async function withTransaction(callback) {
  const topology = mongoose.connection?.client?.topology?.description;
  const isReplicaSet = Boolean(
    topology?.setName ||
    topology?.type === 'ReplicaSetWithPrimary'
  );

  if (!isReplicaSet) {
    return callback(null);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

module.exports = {
  withTransaction,
};

