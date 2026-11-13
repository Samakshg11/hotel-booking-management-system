const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const logger = require('./config/logger');

async function startServer() {
  try {
    await connectDB(env.MONGODB_URI);

    const server = app.listen(env.PORT, () => {
      logger.info(`Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      logger.info(`API Health: http://localhost:${env.PORT}/api/v1/health`);
      logger.info(`Swagger Docs: http://localhost:${env.PORT}/api/docs`);
    });

    const shutdown = async (signal) => {
      logger.info(`Received ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await disconnectDB();
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = startServer;

