const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const { generateOTP } = require('../utils/helpers');
const { sendOTPEmail } = require('../services/emailService');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'default_secret', {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// ============================================
// CHECK EMAIL DOMAIN (Only Gmail)
// ============================================
const validateEmailDomain = (email) => {
  const allowedDomains = ['gmail.com'];
  return allowedDomains.some(domain => email.endsWith(`@${domain}`));
};

// ============================================
// SEND OTP
// ============================================
exports.sendOTP = async (req, res) => {
  try {
    const { email, purpose = 'signup' } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // ✅ Only allow Gmail
    if (!validateEmailDomain(email)) {
      return res.status(400).json({
        success: false,
        message: 'Only @gmail.com email addresses are allowed'
      });
    }

    if (purpose === 'signup') {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }
    }

    await OTP.deleteMany({ email, purpose });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({
      email,
      otp,
      purpose,
      expiresAt,
      attempts: 0,
      verified: false
    });

    await sendOTPEmail(email, otp, purpose);

    res.json({
      success: true,
      message: 'OTP sent successfully to your email',
      expiresIn: '10 minutes'
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

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const otpRecord = await OTP.findOne({ email, otp, purpose });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    if (otpRecord.attempts >= 3) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'Too many failed attempts' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

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

    if (!name || !email || !password || !department || !employeeId || !phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // ✅ Only allow Gmail
    if (!validateEmailDomain(email)) {
      return res.status(400).json({
        success: false,
        message: 'Only @gmail.com email addresses are allowed'
      });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { employeeId }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or employee ID'
      });
    }

    const otpRecord = await OTP.findOne({ email, otp, purpose: 'signup', verified: true });
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or unverified OTP'
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired'
      });
    }

    // If role is HOD, set approval to 'pending'
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

    await OTP.deleteOne({ _id: otpRecord._id });

    const token = generateToken(user._id);

    // If HOD, don't send token, just send message
    if (role === 'hod') {
      return res.status(201).json({
        success: true,
        message: 'HOD registration submitted for approval. An admin will review your request.',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          hodApproval: user.hodApproval
        }
      });
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
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
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // ✅ Only allow Gmail
    if (!validateEmailDomain(email)) {
      return res.status(400).json({
        success: false,
        message: 'Only @gmail.com email addresses are allowed'
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check HOD approval status
    if (user.role === 'hod' && user.hodApproval === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your HOD account is pending approval. Please wait for an admin to approve your request.',
        hodApproval: 'pending'
      });
    }

    if (user.role === 'hod' && user.hodApproval === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your HOD account has been rejected. Please contact the administrator for more information.',
        hodApproval: 'rejected'
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// GET CURRENT USER
// ============================================
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// FORGOT PASSWORD
// ============================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // ✅ Only allow Gmail
    if (!validateEmailDomain(email)) {
      return res.status(400).json({
        success: false,
        message: 'Only @gmail.com email addresses are allowed'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    await OTP.deleteMany({ email, purpose: 'forgot' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({
      email,
      otp,
      purpose: 'forgot',
      expiresAt,
      attempts: 0,
      verified: false
    });

    await sendOTPEmail(email, otp, 'forgot');

    res.json({
      success: true,
      message: 'OTP sent to your email for password reset',
      expiresIn: '10 minutes'
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

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const otpRecord = await OTP.findOne({ email, otp, purpose: 'forgot' });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    if (otpRecord.attempts >= 3) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'Too many failed attempts' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

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

    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, reset token, new password and confirm password are required'
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
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.password = newPassword;
    await user.save();

    await OTP.deleteMany({ email, purpose: 'forgot' });

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
// HOD APPROVAL ROUTES
// ============================================

// Get all pending HOD requests (Only Approved HOD can view)
exports.getPendingHODRequests = async (req, res) => {
  try {
    // Check if current user is an approved HOD
    if (req.user.role !== 'hod' || req.user.hodApproval !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Only approved HODs can view pending requests'
      });
    }

    const pendingHODs = await User.find({
      role: 'hod',
      hodApproval: 'pending'
    }).select('-password');

    res.json({
      success: true,
      data: pendingHODs,
      total: pendingHODs.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Approve or reject HOD request (Only Approved HOD can approve)
exports.approveHOD = async (req, res) => {
  try {
    // Check if current user is an approved HOD
    if (req.user.role !== 'hod' || req.user.hodApproval !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Only approved HODs can approve other HODs'
      });
    }

    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "approved" or "rejected"'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
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

    // Send email notification
    const { sendHODApprovalEmail } = require('../services/emailService');
    await sendHODApprovalEmail(user, status, req.user.name);

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

// Get all HODs (for admin view)
exports.getAllHODs = async (req, res) => {
  try {
    // Check if current user is an approved HOD
    if (req.user.role !== 'hod' || req.user.hodApproval !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Only approved HODs can view all HODs'
      });
    }

    const hods = await User.find({
      role: 'hod'
    }).select('-password');

    res.json({
      success: true,
      data: hods,
      total: hods.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get HOD request count (for dashboard badge)
exports.getHODRequestCount = async (req, res) => {
  try {
    const pendingCount = await User.countDocuments({
      role: 'hod',
      hodApproval: 'pending'
    });

    res.json({
      success: true,
      pending: pendingCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
