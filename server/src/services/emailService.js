const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.FROM_EMAIL,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
});

const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`❌ Email error: ${error.message}`);
    return false;
  }
};

const sendOTPEmail = async (email, otp, purpose = 'signup') => {
  const subjects = { signup: 'Verify Your Email', forgot: 'Password Reset OTP' };
  const titles = { signup: 'Email Verification', forgot: 'Password Reset OTP' };
  
  const html = `
  <div style="font-family:Arial;max-width:500px;margin:40px auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
    <h2 style="color:#1e40af;text-align:center">🏫 NITRR Room Allocation</h2>
    <p style="text-align:center;color:#6b7280">${titles[purpose]}</p>
    <div style="background:#eff6ff;padding:20px;text-align:center;border-radius:8px;margin:20px 0">
      <span style="font-size:36px;font-weight:700;color:#1e40af;letter-spacing:6px">${otp}</span>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:14px">Valid for 5 minutes</p>
    <p style="text-align:center;color:#dc2626;font-size:13px">⚠️ Do not share this OTP</p>
    <hr style="border:1px solid #e5e7eb;margin:20px 0">
    <p style="text-align:center;color:#9ca3af;font-size:12px">NIT Raipur - Room Allocation System</p>
  </div>`;

  return sendEmail(email, subjects[purpose] || 'OTP Verification', html);
};

const sendPasswordResetSuccessEmail = async (email, name) => {
  const html = `
  <div style="font-family:Arial;max-width:500px;margin:40px auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
    <h2 style="color:#059669;text-align:center">✅ Password Reset Success</h2>
    <p>Dear <strong>${name}</strong>,</p>
    <p>Your password has been reset successfully.</p>
    <hr style="border:1px solid #e5e7eb;margin:20px 0">
    <p style="text-align:center;color:#9ca3af;font-size:12px">NIT Raipur - Room Allocation System</p>
  </div>`;
  return sendEmail(email, '✅ Password Reset Successful', html);
};

module.exports = { sendOTPEmail, sendPasswordResetSuccessEmail };
