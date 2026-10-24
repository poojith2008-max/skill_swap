const { ZodError } = require('zod');
const env = require('../config/env');

// Central error handler
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed for request parameters or payload';
    details = err.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid identifier format for field '${err.path}'`;
  }

  // Handle Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    code = 'CONFLICT';
    const field = Object.keys(err.keyValue || {})[0] || 'resource';
    message = `A record with this ${field} already exists`;
    details = err.keyValue;
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Database model validation failed';
    details = Object.values(err.errors).map(val => ({
      path: val.path,
      message: val.message,
    }));
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'UNAUTHORIZED';
    message = 'Invalid authentication token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired. Please log in again';
  }

  // SyntaxError in body parser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = 'Malformed JSON body';
  }

  // In production, do not leak unexpected internal error messages or stacks
  if (statusCode === 500 && env.NODE_ENV === 'production') {
    message = 'Internal server error';
    details = null;
  }

  // Log non-operational or 500 errors
  if (statusCode >= 500) {
    console.error(`💥 [${code}] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      ...(env.NODE_ENV === 'development' && statusCode >= 500 ? { stack: err.stack } : {}),
    },
  });
};

module.exports = errorHandler;
