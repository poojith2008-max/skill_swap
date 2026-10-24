const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const sanitizeMiddleware = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimit');
const AppError = require('./utils/AppError');

// Routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const skillRoutes = require('./routes/skill');
const matchRoutes = require('./routes/match');
const sessionRoutes = require('./routes/session');
const notificationRoutes = require('./routes/notification');
const { reviewRouter } = require('./routes/review');
const conversationRoutes = require('./routes/conversation');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new AppError('CORS policy: Not allowed by CORS', 403, 'CORS_ERROR'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logger
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing with size limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitize MongoDB operators to avoid NoSQL injection
app.use(sanitizeMiddleware);

// Base rate limiter for general API routes
app.use('/api', apiLimiter);

// Health check endpoint
app.use('/api/health', healthRoutes);

// Auth endpoints
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/skills', skillRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/reviews', reviewRouter);
app.use('/api/conversations', conversationRoutes);
app.use('/api/notifications', notificationRoutes);

// In production, serve client static bundle if built
const path = require('path');
const fs = require('fs');
const clientDist = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 404 handler for undefined API routes
app.use('/api/*', (req, res, next) => {
  next(new AppError(`API endpoint ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND'));
});

// Generic 404 for non-API routes when client/dist is not present
app.use('*', (req, res, next) => {
  next(new AppError(`Endpoint ${req.method} ${req.originalUrl} not found`, 404, 'NOT_FOUND'));
});

// Central error handling middleware
app.use(errorHandler);

module.exports = app;
