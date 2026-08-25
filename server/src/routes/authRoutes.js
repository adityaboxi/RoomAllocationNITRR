const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  sendOTP,
  verifyOTP,
  signup,
  login,
  getMe,
  forgotPassword,
  verifyResetOTP,
  resetPassword,
  getPendingHODRequests,
  approveHOD,
  getAllHODs,
  getHODRequestCount
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
router.get('/me', protect, getMe);

// ============================================
// HOD APPROVAL ROUTES (Only Approved HODs)
// ============================================
router.get('/hod-pending', protect, authorize('hod'), getPendingHODRequests);
router.get('/hod-all', protect, authorize('hod'), getAllHODs);
router.get('/hod-count', protect, authorize('hod'), getHODRequestCount);
router.put('/hod-approve/:id', protect, authorize('hod'), approveHOD);

module.exports = router;
