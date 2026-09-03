const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');

// ---------- PROTECT MIDDLEWARE (JWT Verification & User Validation) ----------
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      console.warn(`🔒 [AUTH] No token provided | ${req.method} ${req.originalUrl}`);
      return res.status(401).json({
        success: false,
        message: 'Not authorized. No authentication token provided.',
      });
    }

    // Verify token cryptographic signature
    let decoded;
    try {
      const secret = process.env.JWT_SECRET || 'nitrr_secret_key_default';
      decoded = jwt.verify(token, secret);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        console.warn(`🔒 [AUTH] Token expired | ${req.method} ${req.originalUrl}`);
        return res.status(401).json({
          success: false,
          message: 'Authentication token has expired. Please log in again.',
          expired: true,
        });
      }
      console.warn(`🔒 [AUTH] Invalid token | ${req.method} ${req.originalUrl} | ${jwtError.message}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token.',
      });
    }

    // Fetch user without password field
    let user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      user = await AdminUser.findById(decoded.userId).select('-password');
    }
    if (!user) {
      console.warn(`🔒 [AUTH] User not found for decoded ID: ${decoded.userId}`);
      return res.status(401).json({
        success: false,
        message: 'User account no longer exists.',
      });
    }

    // Check if account has been deactivated
    if (user.isActive === false) {
      console.warn(`🔒 [AUTH] Deactivated account attempted access: ${user.email}`);
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the administrator.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error(`🔒 [AUTH] Protect middleware error:`, error);
    return res.status(401).json({
      success: false,
      message: 'Authentication failed.',
    });
  }
};

// ---------- AUTHORIZE MIDDLEWARE (Role-Based Access Control) ----------
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      console.warn(`🔒 [AUTHZ] Authorization check without authenticated user | ${req.method} ${req.originalUrl}`);
      return res.status(401).json({
        success: false,
        message: 'Authentication required prior to authorization check.',
      });
    }

    if (!roles.includes(req.user.role)) {
      console.warn(`🔒 [AUTHZ] Forbidden: User ${req.user.email} (${req.user.role}) tried to access ${req.originalUrl} (requires: ${roles.join('|')})`);
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }

    next();
  };
};