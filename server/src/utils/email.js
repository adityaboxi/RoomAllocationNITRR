const nodemailer = require('nodemailer');

// Create transporter once, reuse it
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.FROM_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send OTP email for password reset or email verification
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit OTP
 * @param {string} purpose - 'forgot' or 'signup'
 */
exports.sendOTPEmail = async (email, otp, purpose = 'forgot') => {
  const subject = purpose === 'forgot' ? 'Password Reset OTP' : 'Email Verification';
  const html = `
  <div style="font-family:Arial;max-width:500px;margin:40px auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
    <h2 style="color:#1e40af;text-align:center">🏫 NITRR Room Allocation</h2>
    <p style="text-align:center;color:#6b7280">${purpose === 'forgot' ? 'Password Reset OTP' : 'Email Verification'}</p>
    <div style="background:#eff6ff;padding:20px;text-align:center;border-radius:8px;margin:20px 0">
      <span style="font-size:36px;font-weight:700;color:#1e40af;letter-spacing:6px">${otp}</span>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:14px">Valid for 5 minutes</p>
    <p style="text-align:center;color:#dc2626;font-size:13px">⚠️ Do not share this OTP</p>
    <hr style="border:1px solid #e5e7eb;margin:20px 0">
    <p style="text-align:center;color:#9ca3af;font-size:12px">NIT Raipur - Room Allocation System</p>
  </div>`;

  // 🔧 Email sending disabled during testing – OTPs are logged to console.
  // Remove the comment below to enable actual email sending.
  // await transporter.sendMail({
  //   from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
  //   to: email,
  //   subject,
  //   html,
  // });

  console.log(`📧 OTP for ${email}: ${otp}`);
};

/**
 * Send booking confirmation email
 * @param {Object} booking - Booking document (with populated roomId)
 */
exports.sendBookingConfirmationEmail = async (booking) => {
  const html = `
  <div style="font-family:Arial;max-width:500px;margin:40px auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
    <h2 style="color:#059669;text-align:center">✅ Booking Confirmed</h2>
    <p>Dear <strong>${booking.facultyName}</strong>,</p>
    <div style="background:#f0fdf4;padding:15px;border-radius:8px;margin:15px 0">
      <p><strong>Room:</strong> ${booking.roomId?.name} (${booking.roomId?.roomNumber})</p>
      <p><strong>Location:</strong> ${booking.roomId?.building}, ${booking.roomId?.floor}</p>
      <p><strong>Date:</strong> ${booking.date}</p>
      <p><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</p>
      <p><strong>Purpose:</strong> ${booking.purpose}</p>
      ${booking.comment ? `<p><strong>Comment:</strong> ${booking.comment}</p>` : ''}
    </div>
    <hr style="border:1px solid #e5e7eb;margin:20px 0">
    <p style="text-align:center;color:#9ca3af;font-size:12px">NIT Raipur - Room Allocation System</p>
  </div>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
    to: booking.facultyEmail,
    subject: '✅ Booking Confirmed',
    html,
  });
};

/**
 * Send booking cancellation email
 * @param {Object} booking - Booking document (with populated roomId)
 * @param {string} reason - Cancellation reason
 */
exports.sendBookingCancellationEmail = async (booking, reason) => {
  const html = `
  <div style="font-family:Arial;max-width:500px;margin:40px auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
    <h2 style="color:#dc2626;text-align:center">❌ Booking Cancelled</h2>
    <p>Dear <strong>${booking.facultyName}</strong>,</p>
    <p>Your booking has been cancelled:</p>
    <div style="background:#fef2f2;padding:15px;border-radius:8px;margin:15px 0">
      <p><strong>Room:</strong> ${booking.roomId?.name} (${booking.roomId?.roomNumber})</p>
      <p><strong>Date:</strong> ${booking.date}</p>
      <p><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</p>
      <p><strong>Reason:</strong> ${reason}</p>
    </div>
    <hr style="border:1px solid #e5e7eb;margin:20px 0">
    <p style="text-align:center;color:#9ca3af;font-size:12px">NIT Raipur - Room Allocation System</p>
  </div>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
    to: booking.facultyEmail,
    subject: '❌ Booking Cancelled',
    html,
  });
};