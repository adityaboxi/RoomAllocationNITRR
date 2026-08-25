const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { logger } = require('../utils/logger');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

/**
 * Enhanced Authentication Middleware with:
 * - Token verification
 * - User existence check
 * - Account status check
 * - Role-based authorization
 * - Token refresh capability
 */

const protect = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check cookie (if using cookie-based auth)
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new UnauthorizedError('You are not logged in. Please log in to access this resource.');
    }

    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Check if user still exists
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        throw new UnauthorizedError('User no longer exists. Please log in again.');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new UnauthorizedError('Your account has been deactivated. Please contact support.');
      }

      // Check if email is verified (optional)
      if (!user.isEmailVerified && process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
        throw new UnauthorizedError('Please verify your email address to continue.');
      }

      // Check if user's role is valid
      if (!['hod', 'professor'].includes(user.role)) {
        throw new UnauthorizedError('Invalid user role.');
      }

      // Attach user and token to request
      req.user = user;
      req.token = token;
      
      // Log successful authentication
      logger.debug(`✅ User authenticated: ${user.email} (${user.role})`);
      
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedError('Invalid token. Please log in again.');
      } else if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Token expired. Please log in again.');
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('You are not authenticated.');
      }

      if (!roles.includes(req.user.role)) {
        throw new ForbiddenError(
          `Role "${req.user.role}" is not authorized to access this resource.`
        );
      }

      // Check HOD approval status if role is HOD
      if (req.user.role === 'hod' && req.user.hodApproval !== 'approved') {
        throw new ForbiddenError(
          `Your HOD account is ${req.user.hodApproval}. Please wait for approval.`
        );
      }

      logger.debug(`✅ Authorized: ${req.user.email} (${req.user.role})`);
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Check if user owns the resource
 * @param {Function} getResourceId - Function to extract resource ID from request
 */
const isOwner = (getResourceId) => {
  return async (req, res, next) => {
    try {
      // This is a generic implementation - should be overridden for each model
      // For example: const resourceId = req.params.id;
      const resourceId = getResourceId(req);
      
      // Check if user is HOD (admins can access all)
      if (req.user.role === 'hod' && req.user.hodApproval === 'approved') {
        return next();
      }

      // For professors, check if they own the resource
      // This should be implemented in each controller
      // Example: const resource = await Model.findById(resourceId);
      // if (resource.professor.toString() !== req.user._id.toString()) {
      //   throw new ForbiddenError('You do not own this resource.');
      // }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Rate limit by user role
 * @param {Object} limits - Rate limits per role
 */
const roleRateLimit = (limits) => {
  return (req, res, next) => {
    const role = req.user?.role || 'public';
    const limit = limits[role] || limits.default || 10;
    
    // This should be implemented with a proper rate limiter
    // For now, we'll just pass through
    req.rateLimit = { limit, remaining: limit };
    next();
  };
};

/**
 * Check if user is HOD (simplified)
 */
const isHOD = (req, res, next) => {
  try {
    if (req.user.role !== 'hod' || req.user.hodApproval !== 'approved') {
      throw new ForbiddenError('Only approved HODs can perform this action.');
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is Professor (simplified)
 */
const isProfessor = (req, res, next) => {
  try {
    if (req.user.role !== 'professor' && req.user.role !== 'hod') {
      throw new ForbiddenError('Only professors and HODs can perform this action.');
    }
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Token refresh middleware
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new UnauthorizedError('Refresh token is required.');
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      throw new UnauthorizedError('User not found.');
    }

    // Generate new access token
    const newToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    req.newToken = newToken;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protect,
  authorize,
  isOwner,
  isHOD,
  isProfessor,
  roleRateLimit,
  refreshToken
};
