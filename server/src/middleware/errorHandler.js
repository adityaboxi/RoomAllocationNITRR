// ---------- GLOBAL CENTRALIZED ERROR HANDLER ----------
exports.errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message || 'Internal Server Error';

  // Log error details for server diagnostics
  console.error(`🚨 [Error] ${req.method} ${req.originalUrl}:`, err);

  // 1. Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    const message = `Resource not found with ID: ${err.value}`;
    return res.status(404).json({
      success: false,
      message,
    });
  }

  // 2. Mongoose Duplicate Key Error (code 11000)
  if (err.code === 11000) {
    const duplicateFields = Object.keys(err.keyValue || {}).join(', ');
    const message = duplicateFields
      ? `Duplicate entry detected for field(s): ${duplicateFields}. Please use unique values.`
      : 'Duplicate entry detected in database.';
    return res.status(409).json({
      success: false,
      message,
    });
  }

  // 3. Mongoose Schema Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join('; ');
    return res.status(400).json({
      success: false,
      message: `Validation Error: ${message}`,
    });
  }

  // 4. Multer File Upload Errors
  if (err.name === 'MulterError') {
    let message = 'File upload error';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds the 5MB maximum limit';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field encountered in upload';
    }
    return res.status(400).json({
      success: false,
      message,
    });
  }

  // 5. JWT Authentication Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid authentication token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Authentication token has expired',
      expired: true,
    });
  }

  // 6. Default Fallback Error Response
  const statusCode = err.statusCode || res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode >= 400 ? statusCode : 500).json({
    success: false,
    message: error.message || 'Server error occurred. Please try again.',
  });
};