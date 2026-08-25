const { logger } = require('../utils/logger');

/**
 * Custom error classes
 */
class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.errors = errors;
  }
}

class DuplicateError extends AppError {
  constructor(message, field = null) {
    super(message, 409, 'DUPLICATE_ERROR');
    this.field = field;
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT');
  }
}

/**
 * Handle Mongoose validation errors
 */
const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map(error => ({
    field: error.path,
    message: error.message,
    value: error.value
  }));
  return new ValidationError('Validation failed', errors);
};

/**
 * Handle Mongoose duplicate key errors
 */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyPattern)[0];
  const value = err.keyValue[field];
  return new DuplicateError(`${field} "${value}" already exists`, field);
};

/**
 * Handle Mongoose cast errors
 */
const handleCastError = (err) => {
  return new AppError(`Invalid ${err.path}: ${err.value}`, 400, 'CAST_ERROR');
};

/**
 * Handle JWT errors
 */
const handleJWTError = (err) => {
  if (err.name === 'JsonWebTokenError') {
    return new UnauthorizedError('Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return new UnauthorizedError('Token expired');
  }
  return new UnauthorizedError('Authentication failed');
};

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error(`[ERROR] ${err.message}`, {
    statusCode: err.statusCode || 500,
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: err.stack
  });

  // Default error
  let error = err;
  
  // Handle Mongoose errors
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  } else if (err.code === 11000) {
    error = handleDuplicateKeyError(err);
  } else if (err.name === 'CastError') {
    error = handleCastError(err);
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError(err);
  }

  // Send response
  const response = {
    success: false,
    message: error.message || 'Internal server error',
    errorCode: error.errorCode || 'INTERNAL_ERROR'
  };

  // Add validation errors if present
  if (error.errors) {
    response.errors = error.errors;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(error.statusCode || 500).json(response);
};

/**
 * Async wrapper to catch errors
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  ValidationError,
  DuplicateError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  handleValidationError,
  handleDuplicateKeyError,
  handleCastError,
  handleJWTError,
  errorHandler,
  catchAsync
};
