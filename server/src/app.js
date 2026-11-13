const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const env = require('./config/env');
const logger = require('./config/logger');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');
const sanitizeMongo = require('./middleware/sanitizeMongo');

// Route imports
const authRoutes = require('./routes/authRoutes');
const roomTypeRoutes = require('./routes/roomTypeRoutes');
const roomRoutes = require('./routes/roomRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const guestRoutes = require('./routes/guestRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditRoutes = require('./routes/auditRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  env.CLIENT_URL?.replace(/\/+$/, ''),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-side calls)
      if (!origin) return callback(null, true);

      const cleanOrigin = origin.replace(/\/+$/, '');
      if (
        allowedOrigins.includes(cleanOrigin) ||
        /\.vercel\.app$/.test(new URL(origin).hostname) ||
        cleanOrigin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Fallback allow in demo mode
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  })
);

// Body parser
app.use(express.json({ limit: '1mb' }));

// Sanitize MongoDB operators ($ and .)
app.use(sanitizeMongo);

// Logging middleware
if (env.NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger }));
}

// Global rate limiting
app.use('/api', apiLimiter);

// Swagger API Documentation
try {
  const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  logger.warn('openapi.yaml not loaded yet or invalid format');
}

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    data: {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
    },
  });
});

// Mount Routes under /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/room-types', roomTypeRoutes);
app.use('/api/v1/rooms', roomRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/guests', guestRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/audit-logs', auditRoutes);
app.use('/api/v1/admin', adminRoutes);

// Fallback for unmatched routes
app.use('*', (req, res, next) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`,
      details: null,
    },
  });
});

// Centralized error handling
app.use(errorHandler);

module.exports = app;

