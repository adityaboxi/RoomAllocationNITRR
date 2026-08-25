const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { generateOTP } = require('../utils/helpers');
const { sendOTPEmail, sendPasswordResetSuccessEmail } = require('../services/emailService');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// ============================================
// LOGIN WITH ADMIN CHECK
// ============================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔑 Login attempt for: ${email}`);

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password required' 
      });
    }

    // Check allowed domains
    const ALLOWED_DOMAINS = (process.env.TEST_ALLOWED_DOMAINS || 'gmail.com').split(',');
    if (!ALLOWED_DOMAINS.some(d => email.endsWith(`@${d.trim()}`))) {
      return res.status(400).json({
        success: false,
        message: `Only ${ALLOWED_DOMAINS.join(', ')} email addresses are allowed`
      });
    }

    // ============================================
    // STEP 1: Check if user is ADMIN from .env
    // ============================================
    const adminEmail = process.env.ADMIN_EMAIL || 'hod@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Hod@12345';

    if (email === adminEmail && password === adminPassword) {
      console.log('👑 Admin login detected from .env');

      let adminUser = await User.findOne({ email: adminEmail });

      if (!adminUser) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(adminPassword, salt);

        adminUser = await User.create({
          name: process.env.ADMIN_NAME || 'Dr. Admin',
          email: adminEmail,
          password: hashedPassword,
          role: 'hod',
          department: process.env.ADMIN_DEPARTMENT || 'CSE',
          employeeId: process.env.ADMIN_EMPLOYEE_ID || 'ADMIN001',
          phone: process.env.ADMIN_PHONE || '9876543210',
          isEmailVerified: true,
          hodApproval: 'approved',
          isActive: true
        });
        console.log('✅ Admin user created in database');
      }

      adminUser.lastLogin = new Date();
      await adminUser.save();

      const token = generateToken(adminUser._id);
      return res.json({
        success: true,
        message: '👑 Admin login successful',
        token,
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          department: adminUser.department,
          employeeId: adminUser.employeeId,
          hodApproval: adminUser.hodApproval,
          isAdmin: true
        }
      });
    }

    // ============================================
    // STEP 2: Regular user login from database
    // ============================================
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Account deactivated. Please contact admin.' 
      });
    }

    // Check HOD approval status
    if (user.role === 'hod' && user.hodApproval === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your HOD account is pending approval. Please wait for admin approval.',
        hodApproval: 'pending'
      });
    }

    if (user.role === 'hod' && user.hodApproval === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your HOD account has been rejected. Please contact admin.',
        hodApproval: 'rejected'
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
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
        hodApproval: user.hodApproval,
        isAdmin: false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again.' 
    });
  }
};

// ============================================
// SEND OTP (Using MongoDB)
// ============================================
exports.sendOTP = async (req, res) => {
  try {
    const { email, purpose = 'signup' } = req.body;
    console.log(`📧 Sending OTP to: ${email}`);

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
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
        return res.status(400).json({ 
          success: false, 
          message: 'User already exists' 
        });
      }
    }

    // Delete existing OTPs for this email and purpose
    await OTP.deleteMany({ email, purpose });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save OTP to MongoDB
    await OTP.create({
      email,
      otp,
      purpose,
      expiresAt,
      attempts: 0,
      verified: false
    });

    // Send OTP email
    await sendOTPEmail(email, otp, purpose);

    res.json({
      success: true,
      message: 'OTP sent successfully',
      expiresIn: '5 minutes'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send OTP' 
    });
  }
};

// ============================================
// VERIFY OTP (Using MongoDB)
// ============================================
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp, purpose = 'signup' } = req.body;
    console.log(`🔍 Verifying OTP for: ${email}`);

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP required' 
      });
    }

    // Find the OTP
    const otpDoc = await OTP.findOne({
      email,
      purpose,
      otp,
      verified: false
    });

    if (!otpDoc) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    // Check if expired
    if (otpDoc.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired. Request a new one.' 
      });
    }

    // Check attempts
    if (otpDoc.attempts >= 3) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Request new OTP.'
      });
    }

    // Verify OTP
    if (otpDoc.otp !== otp) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = 3 - otpDoc.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remaining} attempts remaining.`
      });
    }

    // Mark as verified
    otpDoc.verified = true;
    await otpDoc.save();

    res.json({
      success: true,
      message: 'OTP verified successfully',
      verified: true
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'OTP verification failed' 
    });
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
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
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
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists' 
      });
    }

    // Verify OTP from MongoDB
    const otpDoc = await OTP.findOne({
      email,
      purpose: 'signup',
      otp,
      verified: true
    });

    if (!otpDoc) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP not verified. Please verify OTP first.' 
      });
    }

    // Check if OTP expired
    if (otpDoc.expiresAt < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired. Please request a new one.' 
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

    // Delete used OTP
    await OTP.deleteMany({ email, purpose: 'signup' });

    if (role === 'hod') {
      return res.status(201).json({
        success: true,
        message: 'HOD registration submitted for approval',
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
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

// ============================================
// FORGOT PASSWORD (Using MongoDB)
// ============================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`🔐 Forgot password for: ${email}`);

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email required' 
      });
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
      return res.status(404).json({ 
        success: false, 
        message: 'No account found with this email' 
      });
    }

    // Delete existing OTPs
    await OTP.deleteMany({ email, purpose: 'forgot' });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Save OTP to MongoDB
    await OTP.create({
      email,
      otp,
      purpose: 'forgot',
      expiresAt,
      attempts: 0,
      verified: false
    });

    // Send OTP email
    await sendOTPEmail(email, otp, 'forgot');

    res.json({
      success: true,
      message: 'OTP sent for password reset',
      expiresIn: '5 minutes'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send OTP' 
    });
  }
};

// ============================================
// VERIFY RESET OTP (Using MongoDB)
// ============================================
exports.verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log(`🔍 Verifying reset OTP for: ${email}`);

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP required' 
      });
    }

    // Find the OTP
    const otpDoc = await OTP.findOne({
      email,
      purpose: 'forgot',
      otp,
      verified: false
    });

    if (!otpDoc) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    // Check if expired
    if (otpDoc.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ 
        success: false, 
        message: 'OTP expired. Request a new one.' 
      });
    }

    // Check attempts
    if (otpDoc.attempts >= 3) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Request new OTP.'
      });
    }

    // Verify OTP
    if (otpDoc.otp !== otp) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = 3 - otpDoc.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remaining} attempts remaining.`
      });
    }

    // Mark as verified
    otpDoc.verified = true;
    await otpDoc.save();

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
    res.status(500).json({ 
      success: false, 
      message: 'OTP verification failed' 
    });
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
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    user.password = newPassword;
    await user.save();

    // Delete used OTPs
    await OTP.deleteMany({ email, purpose: 'forgot' });
    await sendPasswordResetSuccessEmail(email, user.name);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Password reset failed' 
    });
  }
};

// ============================================
// HOD APPROVAL FUNCTIONS
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
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
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
        message: `This request is already ${user.hodApproval}`
      });
    }

    user.hodApproval = status;
    await user.save();

    res.json({
      success: true,
      message: `HOD ${status} successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        hodApproval: user.hodApproval
      }
    });
  } catch (error) {
    console.error('Approve HOD error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};
