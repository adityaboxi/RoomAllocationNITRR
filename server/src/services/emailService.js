const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendOTPEmail = async (email, otp, purpose = 'signup') => {
  const subjects = {
    signup: 'Verify Your Email - NITRR Room Allocation',
    forgot: 'Password Reset OTP - NITRR Room Allocation'
  };

  const titles = {
    signup: 'Email Verification',
    forgot: 'Password Reset OTP'
  };

  const messages = {
    signup: 'Thank you for signing up! Please verify your email address.',
    forgot: 'You requested to reset your password. Use the OTP below.'
  };

  const subject = subjects[purpose] || 'OTP Verification';
  const title = titles[purpose] || 'OTP Verification';
  const message = messages[purpose] || 'Your OTP for verification is:';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
        .container { max-width: 500px; margin: 0 auto; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; padding: 20px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #2563eb; text-align: center; padding: 20px; background: #f0f7ff; border-radius: 8px; letter-spacing: 5px; }
        .footer { text-align: center; padding: 20px 0; color: #6b7280; font-size: 14px; }
        .warning { color: #dc2626; font-size: 14px; text-align: center; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="color: #1e40af;">🏫 NITRR Room Allocation</h1>
          <p style="color: #6b7280;">${title}</p>
        </div>
        <p>Hello,</p>
        <p>${message}</p>
        <div class="otp-code">${otp}</div>
        <p style="text-align: center;">This OTP is valid for <strong>10 minutes</strong>.</p>
        <div class="warning">⚠️ Do not share this OTP with anyone.</div>
        <div class="footer">
          <p>NIT Raipur - Room Allocation System</p>
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@nitrr.ac.in',
    to: email,
    subject,
    html
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };
