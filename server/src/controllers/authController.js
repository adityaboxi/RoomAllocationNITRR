const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { generateOTP } = require('../utils/helpers');
const { sendOTPEmail, sendPasswordResetSuccessEmail } = require('../services/emailService');
const { redisClient } = require('../config/redis');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// ============================================
// SEND OTP
// ============================================
exports.sendOTP = async (req, res) => {
  try {
    const { email, purpose = 'signup' } = req.body;
    console.log(`📧 Sending OTP to: ${email} for purpose: ${purpose}`);
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const ALLOWED_DOMAINS = (process.env.TEST_ALLOWED_DOMAINS || 'gmail.com').split(',');
    if (!ALLOWED_DOMAINS.some(d => email.endsWith(`@${d.trim()}`))) {
      return res.status(400).json({
        success: false,
        message: `Only ${ALLOWED_DOMAINS.join(', ')} email addresses are allowed`
      });
    }

    if (purpose === 'signup') {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User already exists' });
      }
    }

    // Delete existing OTP
    await redisClient.deleteOTP(email, purpose);

    // Generate new OTP
    const otp = generateOTP();
    console.log(`🔑 Generated OTP: ${otp} for ${email}`);

    // Store in Redis
    await redisClient.setOTP(email, otp, purpose);
    
    // Send email
    const emailSent = await sendOTPEmail(email, otp, purpose);
    console.log(`📧 Email sent: ${emailSent ? '✅' : '❌'}`);

    res.json({
      success: true,
      message: 'OTP sent successfully to your email',
      otp: otp, // For debugging only - remove in production
      expiresIn: '5 minutes'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

// ============================================
// VERIFY OTP
// ============================================
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp, purpose = 'signup' } = req.body;
    console.log(`🔍 Verifying OTP for: ${email}, OTP: ${otp}, Purpose: ${purpose}`);

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    // Get stored OTP from Redis
    const stored = await redisClient.getOTP(email, purpose);
    console.log(`📦 Stored OTP data:`, stored);

    if (!stored) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired. Please request a new one.' 
      });
    }

    // Check attempts
    if (stored.attempts >= 3) {
      await redisClient.deleteOTP(email, purpose);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      });
    }

    // Compare OTP
    console.log(`🔑 Comparing: ${stored.otp} vs ${otp}`);
    if (stored.otp !== otp) {
      const attempts = await redisClient.incrementOTPAttempts(email, purpose);
      const remaining = 2 - attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remaining} attempts remaining.`
      });
    }

    // Success - delete OTP
    await redisClient.deleteOTP(email, purpose);
    console.log(`✅ OTP verified successfully for ${email}`);

    res.json({
      success: true,
      message: 'OTP verified successfully',
      verified: true
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};

// ============================================
// SIGNUP
// ============================================
exports.signup = async (req, res) => {
  try {
    const { name, email, password, role, department, employeeId, phone, otp } = req.body;
    console.log(`📝 Signup attempt for: ${email}`);

    if (!name || !email || !password || !department || !employeeId || !phone || !otp) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const ALLOWED_DOMAINS = (process.env.TEST_ALLOWED_DOMAINS || 'gmail.com').split(',');
    if (!ALLOWED_DOMAINS.some(d => email.endsWith(`@${d.trim()}`))) {
      return res.status(400).json({
        success: false,
        message: `Only ${ALLOWED_DOMAINS.join(', ')} email addresses are allowed`
      });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { employeeId }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Verify OTP from Redis
    const stored = await redisClient.getOTP(email, 'signup');
    console.log(`🔍 Stored OTP for signup:`, stored);

    if (!stored || stored.otp !== otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired OTP. Please request a new one.' 
      });
    }

    const userRole = role === 'hod' ? 'hod' : 'professor';
    const hodApproval = role === 'hod' ? 'pending' : 'approved';

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      department,
      employeeId,
      phone,
      isEmailVerified: true,
      hodApproval
    });

    // Delete OTP after successful signup
    await redisClient.deleteOTP(email, 'signup');

    if (role === 'hod') {
      return res.status(201).json({
        success: true,
        message: 'HOD registration submitted for approval. An admin will review your request.',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: userRole,
          department,
          hodApproval
        }
      });
    }

    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: userRole,
        department,
        employeeId,
        hodApproval
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// LOGIN
// ============================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔑 Login attempt for: ${email}`);

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const ALLOWED_DOMAINS = (process.env.TEST_ALLOWED_DOMAINS || 'gmail.com').split(',');
    if (!ALLOWED_DOMAINS.some(d => email.endsWith(`@${d.trim()}`))) {
      return res.status(400).json({
        success: false,
        message: `Only ${ALLOWED_DOMAINS.join(', ')} email addresses are allowed`
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.role === 'hod' && user.hodApproval === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your HOD account is pending approval. Please wait for admin approval.',
        hodApproval: 'pending'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        employeeId: user.employeeId,
        hodApproval: user.hodApproval
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// FORGOT PASSWORD
// ============================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`🔐 Forgot password request for: ${email}`);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    const ALLOWED_DOMAINS = (process.env.TEST_ALLOWED_DOMAINS || 'gmail.com').split(',');
    if (!ALLOWED_DOMAINS.some(d => email.endsWith(`@${d.trim()}`))) {
      return res.status(400).json({
        success: false,
        message: `Only ${ALLOWED_DOMAINS.join(', ')} email addresses are allowed`
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    await redisClient.deleteOTP(email, 'forgot');
    const otp = generateOTP();
    console.log(`🔑 Generated reset OTP: ${otp} for ${email}`);
    await redisClient.setOTP(email, otp, 'forgot');
    await sendOTPEmail(email, otp, 'forgot');

    res.json({
      success: true,
      message: 'OTP sent to your email for password reset',
      expiresIn: '5 minutes'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

// ============================================
// VERIFY RESET OTP
// ============================================
exports.verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log(`🔍 Verifying reset OTP for: ${email}, OTP: ${otp}`);

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    const stored = await redisClient.getOTP(email, 'forgot');
    console.log(`📦 Stored reset OTP:`, stored);

    if (!stored) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired. Please request a new one.' 
      });
    }

    if (stored.attempts >= 3) {
      await redisClient.deleteOTP(email, 'forgot');
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.'
      });
    }

    if (stored.otp !== otp) {
      await redisClient.incrementOTPAttempts(email, 'forgot');
      const remaining = 2 - stored.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remaining} attempts remaining.`
      });
    }

    await redisClient.deleteOTP(email, 'forgot');
    const resetToken = jwt.sign(
      { email },
      process.env.JWT_SECRET + 'reset',
      { expiresIn: '10m' }
    );

    res.json({
      success: true,
      message: 'OTP verified successfully',
      resetToken
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};

// ============================================
// RESET PASSWORD
// ============================================
exports.resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;
    console.log(`🔑 Reset password for: ${email}`);

    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    try {
      jwt.verify(resetToken, process.env.JWT_SECRET + 'reset');
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    await sendPasswordResetSuccessEmail(email, user.name);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
};

// ============================================
// HOD APPROVAL
// ============================================
exports.getPendingHODRequests = async (req, res) => {
  try {
    if (req.user.role !== 'hod' || req.user.hodApproval !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Only approved HODs can view pending requests'
      });
    }

    const pending = await User.find({
      role: 'hod',
      hodApproval: 'pending'
    }).select('-password');

    res.json({
      success: true,
      data: pending,
      total: pending.length
    });
  } catch (error) {
    console.error('Get pending HODs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.approveHOD = async (req, res) => {
  try {
    if (req.user.role !== 'hod' || req.user.hodApproval !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Only approved HODs can approve other HODs'
      });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be approved or rejected'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'hod') {
      return res.status(400).json({
        success: false,
        message: 'User is not a HOD'
      });
    }

    if (user.hodApproval !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This HOD request is already ${user.hodApproval}`
      });
    }

    user.hodApproval = status;
    await user.save();

    res.json({
      success: true,
      message: `HOD request ${status} successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        hodApproval: user.hodApproval
      }
    });
  } catch (error) {
    console.error('Approve HOD error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
