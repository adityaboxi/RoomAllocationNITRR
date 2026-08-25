const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  sendOTP,
  verifyOTP,
  signup,
  login,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  getPendingHODRequests,
  approveHOD
} = require('../controllers/authController');

// ============================================
// PUBLIC ROUTES
// ============================================
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);

// ============================================
// PROTECTED ROUTES
// ============================================
router.get('/me', protect, (req, res) => {
  res.json({ success: true, user: req.user });
});

// ============================================
// HOD APPROVAL ROUTES
// ============================================
router.get('/hod-pending', protect, authorize('hod'), getPendingHODRequests);
router.put('/hod-approve/:id', protect, authorize('hod'), approveHOD);

module.exports = router;
