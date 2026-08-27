const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const { generateOTP, generateToken } = require('../utils/helpers');
const { sendOTPEmail } = require('../utils/email');

// ---------- LOGIN (no rate limiting) ----------
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

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

// ---------- SIGNUP ----------
exports.signup = async (req, res) => {
  try {
    const { name, email, password, confirmPassword, department } = req.body;
    if (!name || !email || !password || !confirmPassword || !department) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
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
      return res.status(400).json({ success: false, message: 'Only @gmail.com emails allowed' });
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

// ---------- FORGOT PASSWORD (no OTP expiry/attempts check) ----------
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    // Generate and save OTP (no check for existing OTP)
    const otp = generateOTP();
    console.log(`📧 OTP for ${email}: ${otp}`);
    await OTP.create({
      email,
      otp,
      purpose: 'forgot',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // still set expiry but we won't check it
    });

    // Optionally send email (currently disabled for testing)
    // await sendOTPEmail(email, otp, 'forgot');

    res.json({ success: true, message: 'OTP sent (check console)', expiresIn: '5 minutes' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- VERIFY OTP (no expiry, no attempts check) ----------
exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    // Find the OTP record (ignore expiry and attempts)
    const otpDoc = await OTP.findOne({ email, purpose: 'forgot', otp });
    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Delete the OTP to prevent reuse (optional)
    await OTP.deleteOne({ _id: otpDoc._id });

    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET + 'reset', { expiresIn: '10m' });
    res.json({ success: true, message: 'OTP verified successfully', resetToken });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};

// ---------- RESET PASSWORD ----------
exports.resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;
    if (!email || !resetToken || !newPassword || !confirmPassword) {
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

    try {
      jwt.verify(resetToken, process.env.JWT_SECRET + 'reset');
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.password = newPassword;
    await user.save();
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
    res.status(500).json({ success: false, message: 'Server error' });
  }
};