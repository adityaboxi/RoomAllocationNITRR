const nodemailer = require('nodemailer');
const { maskEmail } = require('../utils/helpers');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConnected = false;
    this.init();
  }

  init() {
    const config = {
      host: process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || process.env.EMAIL_USER || process.env.FROM_EMAIL,
        pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    };
    this.transporter = nodemailer.createTransport(config);
    this.verifyConnection();
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      this.isConnected = true;
      console.log('✅ Email service connected');
    } catch (error) {
      this.isConnected = false;
      console.error(`❌ Email service error: ${error.message}`);
    }
  }

  async sendEmail(mailOptions, retries = 0) {
    try {
      if (!this.isConnected) await this.verifyConnection();
      if (!this.isConnected) throw new Error('Email service not connected');
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Email send failed: ${error.message}`);
      if (retries < 3) {
        const delay = Math.pow(2, retries) * 1000;
        await this.sleep(delay);
        return this.sendEmail(mailOptions, retries + 1);
      }
      return { success: false, error: error.message };
    }
  }

  async sendOTPEmail(email, otp, purpose = 'signup') {
    const subjects = { signup: 'Verify Your Email - NITRR Room Allocation', forgot: 'Password Reset OTP - NITRR Room Allocation' };
    const titles = { signup: 'Email Verification', forgot: 'Password Reset OTP' };
    const messages = { signup: 'Thank you for signing up! Please verify your email address.', forgot: 'You requested to reset your password. Use the OTP below.' };

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${subjects[purpose]}</title><style>body{font-family:Arial,sans-serif;background:#f4f7fc;margin:0;padding:0}.container{max-width:550px;margin:40px auto;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.12);overflow:hidden}.header{background:linear-gradient(135deg,#1e40af,#3b82f6);padding:30px 20px;text-align:center}.header h1{color:#fff;font-size:24px;margin:0}.body{padding:35px 30px}.otp-box{background:#eff6ff;border-radius:12px;padding:25px;text-align:center;margin:20px 0;border:2px dashed #3b82f6}.otp-code{font-size:40px;font-weight:700;color:#1e40af;letter-spacing:8px;font-family:'Courier New',monospace}.footer{background:#f8fafc;padding:20px 30px;text-align:center}.footer p{color:#9ca3af;font-size:12px;margin:3px 0}.warning{color:#dc2626;font-size:13px;text-align:center;margin-top:10px}</style></head><body><div class="container"><div class="header"><h1>🏫 NITRR Room Allocation</h1><p>${titles[purpose]}</p></div><div class="body"><p>Hello,</p><p>${messages[purpose]}</p><div class="otp-box"><div class="otp-code">${otp}</div><div style="font-size:13px;color:#6b7280;margin-top:5px">Valid for 5 minutes</div></div><div class="warning">⚠️ Do not share this OTP with anyone.</div></div><div class="footer"><p>© 2024 NIT Raipur - Room Allocation System</p></div></div></body></html>`;

    return this.sendEmail({
      from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
      to: email,
      subject: subjects[purpose] || 'OTP Verification',
      html
    });
  }

  async sendPasswordResetSuccessEmail(email, name) {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Password Reset</title><style>body{font-family:Arial,sans-serif;background:#f4f7fc;margin:0;padding:0}.container{max-width:550px;margin:40px auto;background:#fff;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.12);overflow:hidden}.header{background:linear-gradient(135deg,#059669,#10b981);padding:30px 20px;text-align:center}.header h1{color:#fff;font-size:24px;margin:0}.body{padding:35px 30px}.success-box{background:#ecfdf5;border-radius:12px;padding:25px;text-align:center;border:2px solid #10b981}.footer{background:#f8fafc;padding:20px 30px;text-align:center}</style></head><body><div class="container"><div class="header"><h1>✅ Password Reset Successful</h1></div><div class="body"><p>Dear <strong>${name}</strong>,</p><div class="success-box"><div style="font-size:48px">🔐</div><h2 style="color:#059669">Password Reset Successful</h2><p style="color:#6b7280">Your password has been reset successfully.</p></div></div><div class="footer"><p>© 2024 NIT Raipur - Room Allocation System</p></div></div></body></html>`;
    return this.sendEmail({
      from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
      to: email,
      subject: '✅ Password Reset Successful - NITRR Room Allocation',
      html
    });
  }

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
}

const emailService = new EmailService();

module.exports = { emailService, sendOTPEmail: (email, otp, purpose) => emailService.sendOTPEmail(email, otp, purpose), sendPasswordResetSuccessEmail: (email, name) => emailService.sendPasswordResetSuccessEmail(email, name) };
