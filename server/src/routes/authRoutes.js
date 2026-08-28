const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  login,
  signup,
  sendSignupOtp,
  verifySignupOtp,
  changePassword,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  getMe,
  getDepartments,
} = require('../controllers/authController');

// Public Authentication & Metadata Routes
router.get('/departments', getDepartments); // Dynamic branch list from .env
router.post('/login', login);
router.post('/signup', signup); // Direct signup fallback
router.post('/send-signup-otp', sendSignupOtp);
router.post('/verify-signup-otp', verifySignupOtp);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

// Protected User Routes (Require Valid Bearer Token)
router.get('/me', protect, getMe);
router.post('/change-password', protect, changePassword);

module.exports = router;