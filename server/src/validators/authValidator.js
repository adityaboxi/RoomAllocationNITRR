const validateEmail = (email) => {
  const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || 'nitrr.ac.in';
  const emailRegex = new RegExp(`^[a-zA-Z0-9._%+-]+@${allowedDomain}$`);
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

const validateSignup = (data) => {
  const errors = [];
  const { name, email, password, confirmPassword, department, employeeId, phone, role } = data;

  if (!name || name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  }

  if (!email || !validateEmail(email)) {
    errors.push(`Invalid email format. Only @${process.env.ALLOWED_EMAIL_DOMAIN || 'nitrr.ac.in'} domain allowed`);
  }

  if (!password || !validatePassword(password)) {
    errors.push('Password must be at least 6 characters long');
  }

  if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }

  if (!department) {
    errors.push('Department is required');
  }

  if (!employeeId || employeeId.trim().length < 1) {
    errors.push('Employee ID is required');
  }

  if (!phone || phone.length < 10) {
    errors.push('Valid phone number is required');
  }

  if (role && !['hod', 'professor'].includes(role)) {
    errors.push('Role must be either hod or professor');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateLogin = (data) => {
  const errors = [];
  const { email, password } = data;

  if (!email || !validateEmail(email)) {
    errors.push(`Invalid email format. Only @${process.env.ALLOWED_EMAIL_DOMAIN || 'nitrr.ac.in'} domain allowed`);
  }

  if (!password) {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateForgotPassword = (data) => {
  const errors = [];
  const { email } = data;

  if (!email || !validateEmail(email)) {
    errors.push(`Invalid email format. Only @${process.env.ALLOWED_EMAIL_DOMAIN || 'nitrr.ac.in'} domain allowed`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateResetPassword = (data) => {
  const errors = [];
  const { email, newPassword, confirmPassword, resetToken } = data;

  if (!email || !validateEmail(email)) {
    errors.push(`Invalid email format. Only @${process.env.ALLOWED_EMAIL_DOMAIN || 'nitrr.ac.in'} domain allowed`);
  }

  if (!newPassword || newPassword.length < 6) {
    errors.push('New password must be at least 6 characters long');
  }

  if (newPassword !== confirmPassword) {
    errors.push('Passwords do not match');
  }

  if (!resetToken) {
    errors.push('Reset token is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

const validateOTP = (data) => {
  const errors = [];
  const { email, otp } = data;

  if (!email || !validateEmail(email)) {
    errors.push(`Invalid email format. Only @${process.env.ALLOWED_EMAIL_DOMAIN || 'nitrr.ac.in'} domain allowed`);
  }

  if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    errors.push('OTP must be a 6-digit number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateEmail,
  validatePassword,
  validateSignup,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateOTP
};
