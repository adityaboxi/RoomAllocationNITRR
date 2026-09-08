const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { generateOTP, generateToken, getJwtSecret } = require('../utils/helpers');
const { sendOTPEmail } = require('../utils/email');

// Mapping of departments to allowed email subdomains at NIT Raipur
const DEPARTMENT_SUBDOMAINS = {
  'Computer Science & Engineering': ['cse', 'cs'],
  'Information Technology': ['it'],
  'Mechanical Engineering': ['me', 'mech'],
  'Electronics & Communication': ['ece', 'etc'],
  'Electrical Engineering': ['ee', 'elec'],
  'Civil Engineering': ['ce', 'civil'],
  'Chemical Engineering': ['che', 'chem'],
  'Biotechnology': ['bt', 'biotech'],
  'Metallurgical & Materials': ['mme', 'meta'],
  'Mining Engineering': ['min', 'mining'],
};

// Helper to validate institutional email subdomain against selected department
const validateEmailDepartmentMatch = (email, department) => {
  if (!email || !department) return { valid: true };

  const cleanEmail = email.trim().toLowerCase();
  const domainPart = cleanEmail.split('@')[1] || '';
  const domainTokens = domainPart.split('.');

  // Institutional format: user@<branch>.nitrr.ac.in (or aboxi006.btech2024@cse.nitrr.ac.in)
  if (domainTokens.length >= 4 && domainPart.endsWith('nitrr.ac.in')) {
    const branchSubdomain = domainTokens[domainTokens.length - 4];
    const allowed = DEPARTMENT_SUBDOMAINS[department];

    if (allowed && !allowed.includes(branchSubdomain)) {
      return {
        valid: false,
        message: `🚫 Email mismatch: Your institutional email domain (@${branchSubdomain}.nitrr.ac.in) does not belong to "${department}".`,
      };
    }
  }

  return { valid: true };
};

// Helper to get configured departments dynamically from environment variables
const getConfiguredDepartments = () => {
  const defaultList = [
    'Computer Science & Engineering',
    'Information Technology',
    'Electronics & Communication',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Civil Engineering',
    'Chemical Engineering',
    'Biotechnology',
    'Metallurgical & Materials',
    'Mining Engineering',
    'Common / Institute Level',
  ];

  if (!process.env.DEPARTMENTS) {
    return defaultList;
  }

  const parsed = process.env.DEPARTMENTS.split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  const finalList = parsed.length > 0 ? parsed : defaultList;
  if (!finalList.includes('Common / Institute Level')) {
    finalList.push('Common / Institute Level');
  }
  return finalList;
};

// Helper to safely encrypt temporary password in OTP collection
const encryptTemporaryPassword = (password) => {
  const key = crypto.createHash('sha256').update(getJwtSecret()).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
};

// Helper to decrypt temporary password during signup verification
const decryptTemporaryPassword = (encryptedData) => {
  const key = crypto.createHash('sha256').update(getJwtSecret()).digest();
  const [ivHex, encryptedText] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// ---------- GET DEPARTMENTS (Dynamic from .env) ----------
exports.getDepartments = async (req, res) => {
  try {
    const departments = getConfiguredDepartments();
    res.json({
      success: true,
      data: departments,
      total: departments.length,
    });
  } catch (error) {
    console.error('❌ [AUTH] getDepartments error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- LOGIN ----------
exports.login = async (req, res) => {
  try {
    let { email, password, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    email = email.trim().toLowerCase();

    // 🔒 1. GLOBAL SUPER-ADMIN FLOW (Runs strictly when role selected is ADMIN)
    if (role === 'ADMIN') {
      const isCorrectAdminEmail = Boolean(
        process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.trim().toLowerCase()
      );
      const isCorrectAdminPass = Boolean(
        process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD
      );

      if (!isCorrectAdminEmail || !isCorrectAdminPass) {
        return res.status(401).json({
          success: false,
          message: 'Invalid administrator credentials.',
        });
      }

      const AdminUser = require('../models/AdminUser');
      let adminUser = await AdminUser.findOne({ email });
      
      // Seed or ensure admin account exists in MongoDB
      if (!adminUser) {
        adminUser = await AdminUser.create({
          name: 'System Admin',
          email,
          password: process.env.ADMIN_PASSWORD,
          role: 'ADMIN',
          department: 'ALL',
          isFirstLogin: false
        });
      }

      await adminUser.updateLastLogin();
      const token = generateToken(adminUser._id);
      
      return res.json({
        success: true,
        token,
        user: {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: 'ADMIN',
          department: 'ALL',
          isFirstLogin: false
        },
      });
    }

    // 🔒 2. BRANCH ADMIN / HOD / FACULTY LOGIN FLOW
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    
    // Ensure they selected the correct tab for their regular account
    if (role && user.role !== role) {
      return res.status(403).json({ success: false, message: `Your account is registered as ${user.role}. Please select the correct role tab.` });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated. Please contact the administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
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
        department: user.department,
      },
    });
  } catch (error) {
    console.error('❌ [AUTH] Login error:', error.message || error);
    res.status(500).json({ success: false, message: 'Server error occurred during login' });
  }
};

// ---------- DIRECT SIGNUP ----------
exports.signup = async (req, res) => {
  try {
    let { name, email, password, confirmPassword, department, role: requestedRole } = req.body;
    if (!name || !email || !password || !confirmPassword || !department) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    name = name.trim();
    email = email.trim().toLowerCase();
    department = department.trim();

    const validDepartments = getConfiguredDepartments();
    if (!validDepartments.includes(department)) {
      return res.status(400).json({
        success: false,
        message: `Invalid department selected. Allowed: ${validDepartments.join(', ')}`,
      });
    }

    // 🔒 Validate email subdomain matches the selected branch (cs/cse allowed for Computer Science)
    const matchCheck = validateEmailDepartmentMatch(email, department);
    if (!matchCheck.valid) {
      return res.status(400).json({ success: false, message: matchCheck.message });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }
    
    if (!User.isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Only authorized email addresses ending in .nitrr.ac.in are allowed.',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email address' });
    }

    // Assign role safely - Administrator accounts cannot be created publicly
    if (requestedRole === 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Administrator accounts cannot be registered publicly. They are provisioned via system environment variables.',
      });
    }
    const role = requestedRole === 'HOD' ? 'HOD' : 'FACULTY';

    // 🔒 Enforce Single Role per Department Rule (1 HOD and 1 ADMIN per branch)
    if (role === 'HOD' || role === 'ADMIN') {
      const existingLeader = await User.findOne({ role, department, isActive: true });
      if (existingLeader) {
        return res.status(400).json({
          success: false,
          message: `🚫 Cannot register as ${role}: ${existingLeader.name} (${existingLeader.email}) is already the active ${role} for "${department}".`,
        });
      }
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
        department: user.department,
      },
    });
  } catch (error) {
    console.error('❌ [AUTH] Signup error:', error.message || error);
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
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    if (req.user?.role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Administrator password cannot be changed via the dashboard. Please update ADMIN_PASSWORD in your server .env file.',
      });
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
    console.error('❌ [AUTH] Change password error:', error.message || error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- FORGOT PASSWORD (NON-BLOCKING FAST DISPATCH) ----------
exports.forgotPassword = async (req, res) => {
  try {
    let { email, role } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    if (role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Password reset is disabled for Administrator accounts.',
      });
    }

    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email address' });
    }

    // Invalidate existing forgot-password OTPs
    await OTP.deleteMany({ email, purpose: 'forgot' });

    const otp = generateOTP();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES, 10);

    await OTP.create({
      email,
      otp,
      purpose: 'forgot',
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
    });

    // ⚡ Fast Background Email Dispatch
    sendOTPEmail(email, otp, 'forgot').catch((err) => {
      console.error('❌ [AUTH] Forgot password email dispatch error:', err.message || err);
    });

    res.json({
      success: true,
      message: 'Password reset code sent to your email',
      expiresIn: `${expiryMinutes} minutes`,
    });
  } catch (error) {
    console.error('❌ [AUTH] Forgot password error:', error.message || error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- VERIFY RESET OTP ----------
exports.verifyResetOtp = async (req, res) => {
  try {
    let { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    email = email.trim().toLowerCase();
    otp = otp.trim();

    const otpDoc = await OTP.findOneAndDelete({
      email,
      purpose: 'forgot',
      otp,
      expiresAt: { $gt: new Date() },
    });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    const secret = getJwtSecret() + 'reset';
    const resetToken = jwt.sign({ email }, secret, { expiresIn: '10m' });
    res.json({ success: true, message: 'OTP verified successfully', resetToken });
  } catch (error) {
    console.error('❌ [AUTH] Verify reset OTP error:', error.message || error);
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};

// ---------- RESET PASSWORD ----------
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
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }

    let decoded;
    try {
      const secret = getJwtSecret() + 'reset';
      decoded = jwt.verify(resetToken, secret);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset token' });
    }

    if (!decoded || decoded.email !== email) {
      return res.status(403).json({ success: false, message: 'Reset token does not match provided email' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();

    await OTP.deleteMany({ email, purpose: 'forgot' });

    res.json({ success: true, message: 'Password reset successfully. You may now sign in.' });
  } catch (error) {
    console.error('❌ [AUTH] Reset password error:', error.message || error);
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
};

// ---------- GET ME ----------
exports.getMe = async (req, res) => {
  try {
    let user = await User.findById(req.user.id);
    if (!user) {
      const AdminUser = require('../models/AdminUser');
      user = await AdminUser.findById(req.user.id);
    }
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
        department: user.department,
      },
    });
  } catch (error) {
    console.error('❌ [AUTH] GetMe error:', error.message || error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- SEND SIGNUP OTP (NON-BLOCKING FAST DISPATCH) ----------
exports.sendSignupOtp = async (req, res) => {
  try {
    let { name, email, password, confirmPassword, department, role: requestedRole } = req.body;
    if (!name || !email || !password || !confirmPassword || !department) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    name = name.trim();
    email = email.trim().toLowerCase();
    department = department.trim();

    const validDepartments = getConfiguredDepartments();
    if (!validDepartments.includes(department)) {
      return res.status(400).json({
        success: false,
        message: `Invalid department selected. Allowed: ${validDepartments.join(', ')}`,
      });
    }

    // 🔒 Validate email subdomain matches the selected branch before sending OTP
    const matchCheck = validateEmailDepartmentMatch(email, department);
    if (!matchCheck.valid) {
      return res.status(400).json({ success: false, message: matchCheck.message });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long' });
    }
    
    if (!User.isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Only authorized email addresses ending in .nitrr.ac.in are allowed.',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    if (requestedRole === 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Administrator accounts cannot be registered publicly.',
      });
    }
    const role = requestedRole === 'HOD' ? 'HOD' : 'FACULTY';

    // 🔒 Enforce Single Role per Department BEFORE dispatching OTP
    if (role === 'HOD' || role === 'ADMIN') {
      const existingLeader = await User.findOne({ role, department, isActive: true });
      if (existingLeader) {
        return res.status(400).json({
          success: false,
          message: `🚫 Cannot register as ${role}: ${existingLeader.name} (${existingLeader.email}) is already the active ${role} for "${department}".`,
        });
      }
    }

    await OTP.deleteMany({ email, purpose: 'signup' });

    const otp = generateOTP();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES, 10);

    const encryptedPassword = encryptTemporaryPassword(password);

    await OTP.create({
      email,
      otp,
      purpose: 'signup',
      expiresAt: new Date(Date.now() + expiryMinutes * 60 * 1000),
      userData: { name, email, encryptedPassword, department, role },
    });

    // ⚡ Fast Background Email Dispatch
    sendOTPEmail(email, otp, 'signup').catch((err) => {
      console.error('❌ [AUTH] Signup OTP email dispatch error:', err.message || err);
    });

    res.json({
      success: true,
      message: 'Verification OTP sent to your email',
      expiresIn: `${expiryMinutes} minutes`,
    });
  } catch (error) {
    console.error('❌ [AUTH] Send signup OTP error:', error.message || error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ---------- VERIFY SIGNUP OTP ----------
exports.verifySignupOtp = async (req, res) => {
  try {
    let { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    email = email.trim().toLowerCase();
    otp = otp.trim();

    const otpDoc = await OTP.findOneAndDelete({
      email,
      purpose: 'signup',
      otp,
      expiresAt: { $gt: new Date() },
    });

    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code' });
    }

    const { name, encryptedPassword, department, role: savedRole } = otpDoc.userData || {};
    if (!name || !encryptedPassword || !department) {
      return res.status(400).json({ success: false, message: 'Incomplete signup data. Please request a new OTP.' });
    }

    // 🔒 Extra validation barrier on OTP verification
    const matchCheck = validateEmailDepartmentMatch(email, department);
    if (!matchCheck.valid) {
      return res.status(400).json({ success: false, message: matchCheck.message });
    }

    const password = decryptTemporaryPassword(encryptedPassword);
    const role = ['HOD', 'ADMIN'].includes(savedRole) ? savedRole : 'FACULTY';

    // 🔒 Final Safety Check for Duplicate Role before saving
    if (role === 'HOD' || role === 'ADMIN') {
      const existingLeader = await User.findOne({ role, department, isActive: true });
      if (existingLeader) {
        return res.status(400).json({
          success: false,
          message: `🚫 Cannot register as ${role}: ${existingLeader.name} (${existingLeader.email}) is already the active ${role} for "${department}".`,
        });
      }
    }

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
    console.error('❌ [AUTH] Verify signup OTP error:', error.message || error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
};