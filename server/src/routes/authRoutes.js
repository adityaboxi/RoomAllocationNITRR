const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  login, signup, changePassword, forgotPassword,
  verifyResetOtp, resetPassword, getMe
} = require('../controllers/authController');

router.post('/login', login);
router.post('/signup', signup);
router.post('/change-password', protect, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);

module.exports = router;