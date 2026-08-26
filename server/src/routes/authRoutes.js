const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  login,
  signup,
  forgotPassword,
  getMe,
} = require('../controllers/authController');

router.post('/login', login);
router.post('/signup', signup);
router.post('/forgot-password', forgotPassword);
router.get('/me', protect, getMe);

module.exports = router;
