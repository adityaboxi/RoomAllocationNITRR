const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { generateOTP, generateToken } = require('../utils/helpers');
const { sendOTPEmail } = require('../utils/email');

// Helper to safely encrypt temporary password in OTP collection
const encryptTemporaryPassword = (password) => {
  const key = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'fallback_secret_key').digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

// Helper to decrypt temporary password during signup verification
const decryptTemporaryPassword = (encryptedData) => {
  const key = crypto.createHash('sha256').update(process.env.JWT_SECRET || 'fallback_secret_key').digest();
  const [ivHex, encryptedText] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// ---------- LOGIN ----------
exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    email = email.trim().toLowerCase();

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact admin.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await user.updateLastLogin();
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- DIRECT SIGNUP (Fallback Endpoint) ----------
exports.signup = async (req, res) => {
  try {
    let { name, email, password, confirmPassword, department } = req.body;
    if (!name || !email || !password || !confirmPassword || !department) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain uppercase, lowercase, number, and special character' });
    }
    if (!User.isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Only @gmail.com or @cse.nitrr.ac.in emails are allowed' });
    }
    if (name.length > 100) {
      return res.status(400).json({ success: false, message: 'Name cannot exceed 100 characters' });
    }

    const role = User.detectRole(email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const user = await User.create({ name, email, password, role, department, isActive: true });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- CHANGE PASSWORD ----------
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain uppercase, lowercase, number, and special character' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- FORGOT PASSWORD ----------
exports.forgotPassword = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    // Invalidate any existing forgot-password OTPs for this email
    await OTP.deleteMany({ email, purpose: 'forgot' });

    const otp = generateOTP();
    console.log(`📧 OTP for ${email}: ${otp}`);

    await OTP.create({
      email,
      otp,
      purpose: 'forgot',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    try {
      await sendOTPEmail(email, otp, 'forgot');
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError.message);
    }

    res.json({ success: true, message: 'OTP sent to your email', expiresIn: '5 minutes' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- VERIFY RESET OTP (Atomic to prevent race conditions) ----------
exports.verifyResetOtp = async (req, res) => {
  try {
    let { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    email = email.trim().toLowerCase();
    otp = otp.trim();

    // Atomic find and delete only if not expired
    const otpDoc = await OTP.findOneAndDelete({
      email,
      purpose: 'forgot',
      otp,
      expiresAt: { $gt: new Date() }
    });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET + 'reset', { expiresIn: '10m' });
    res.json({ success: true, message: 'OTP verified successfully', resetToken });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};

// ---------- RESET PASSWORD (Secured against token/email mismatch) ----------
exports.resetPassword = async (req, res) => {
  try {
    let { email, resetToken, newPassword, confirmPassword } = req.body;
    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    email = email.trim().toLowerCase();

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain uppercase, lowercase, number, and special character' });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET + 'reset');
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset token' });
    }

    // CRITICAL SECURITY FIX: Validate that token belongs to this exact email
    if (!decoded || decoded.email !== email) {
      return res.status(403).json({ success: false, message: 'Reset token does not match provided email' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    // Invalidate any remaining OTPs
    await OTP.deleteMany({ email, purpose: 'forgot' });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
};

// ---------- GET ME ----------
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- SEND SIGNUP OTP (Step 1 - Encrypted Password Payload) ----------
exports.sendSignupOtp = async (req, res) => {
  try {
    let { name, email, password, confirmPassword, department } = req.body;
    if (!name || !email || !password || !confirmPassword || !department) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    name = name.trim();
    email = email.trim().toLowerCase();

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain uppercase, lowercase, number, and special character' });
    }
    if (!User.isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Only @gmail.com or @cse.nitrr.ac.in emails are allowed' });
    }
    if (name.length > 100) {
      return res.status(400).json({ success: false, message: 'Name cannot exceed 100 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // Invalidate existing signup OTPs for this email to prevent multiple valid OTPs
    await OTP.deleteMany({ email, purpose: 'signup' });

    const otp = generateOTP();
    console.log(`📧 Signup OTP for ${email}: ${otp}`);

    // Encrypt password before storing in temporary MongoDB OTP record
    const encryptedPassword = encryptTemporaryPassword(password);

    await OTP.create({
      email,
      otp,
      purpose: 'signup',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      userData: { name, email, encryptedPassword, department },
    });

    try {
      await sendOTPEmail(email, otp, 'signup');
    } catch (emailError) {
      console.error('Failed to send signup OTP email:', emailError.message);
    }

    res.json({ success: true, message: 'OTP sent to your email', expiresIn: '5 minutes' });
  } catch (error) {
    console.error('Send signup OTP error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- VERIFY SIGNUP OTP (Step 2 - Atomic Creation & Cleanup) ----------
exports.verifySignupOtp = async (req, res) => {
  try {
    let { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    email = email.trim().toLowerCase();
    otp = otp.trim();

    // Atomic find and delete to prevent concurrent registration race conditions
    const otpDoc = await OTP.findOneAndDelete({
      email,
      purpose: 'signup',
      otp,
      expiresAt: { $gt: new Date() }
    });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const { name, encryptedPassword, department } = otpDoc.userData || {};
    if (!name || !encryptedPassword || !department) {
      return res.status(400).json({ success: false, message: 'Incomplete signup data. Please request a new OTP.' });
    }

    const password = decryptTemporaryPassword(encryptedPassword);
    const role = User.detectRole(email);

    const user = await User.create({ name, email, password, role, department, isActive: true });
    const token = generateToken(user._id);
    await user.updateLastLogin();

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    console.error('Verify signup OTP error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};