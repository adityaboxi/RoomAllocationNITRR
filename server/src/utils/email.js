const nodemailer = require('nodemailer');

// Initialize Nodemailer transporter with connection pool
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || process.env.FROM_EMAIL,
    pass: process.env.SMTP_PASS,
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

// Helper to get normalized sender address
const getFromAddress = () =>
  process.env.EMAIL_FROM ||
  process.env.FROM_EMAIL ||
  process.env.SMTP_USER ||
  'noreply@nitrr.ac.in';

/**
 * Send OTP email for password reset or email verification
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit OTP
 * @param {string} purpose - 'forgot' or 'signup'
 */
exports.sendOTPEmail = async (email, otp, purpose = 'forgot') => {
  const subject = purpose === 'forgot' ? '🔑 Password Reset OTP' : '✉️ Email Verification OTP';
  const html = `
  <div style="font-family:Arial, sans-serif;max-width:500px;margin:40px auto;background:#ffffff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);border:1px solid #e2e8f0;">
    <h2 style="color:#1e40af;text-align:center;margin-top:0;">🏫 NITRR Room Allocation</h2>
    <p style="text-align:center;color:#4b5563;font-size:16px;">${purpose === 'forgot' ? 'Password Reset Request' : 'Account Verification'}</p>
    <div style="background:#eff6ff;padding:20px;text-align:center;border-radius:8px;margin:20px 0;border:1px dashed #3b82f6;">
      <span style="font-size:36px;font-weight:700;color:#1e40af;letter-spacing:6px;font-family:monospace;">${otp}</span>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:14px;margin-bottom:5px;">Valid for <strong>5 minutes</strong>.</p>
    <p style="text-align:center;color:#dc2626;font-size:13px;margin-top:0;">⚠️ If you did not request this, please ignore this email.</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-bottom:0;">NIT Raipur — Room Allocation System</p>
  </div>`;

  console.log(`📧 [OTP Dispatch] Recipient: ${email} | Code: ${otp} | Purpose: ${purpose}`);

  // Only attempt transport if SMTP credentials are provided
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await transporter.sendMail({
        from: `NITRR Room Allocation <${getFromAddress()}>`,
        to: email,
        subject,
        html,
      });
      console.log(`✅ OTP email successfully delivered to ${email}`);
    } catch (err) {
      console.error(`❌ SMTP transport failed for ${email}:`, err.message);
    }
  }
};

/**
 * Send booking confirmation email
 * @param {Object} booking - Booking document (with populated roomId)
 */
exports.sendBookingConfirmationEmail = async (booking) => {
  const roomName = booking.roomId?.name || 'Classroom';
  const roomNumber = booking.roomId?.roomNumber ? `(${booking.roomId.roomNumber})` : '';
  const building = booking.roomId?.building || 'Main Campus';
  const floor = booking.roomId?.floor || 'Ground Floor';

  const html = `
  <div style="font-family:Arial, sans-serif;max-width:520px;margin:40px auto;background:#ffffff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);border:1px solid #e2e8f0;">
    <h2 style="color:#059669;text-align:center;margin-top:0;">✅ Booking Confirmed</h2>
    <p style="color:#374151;font-size:15px;">Dear <strong>${booking.facultyName}</strong>,</p>
    <p style="color:#4b5563;font-size:14px;">Your room allocation request has been approved and confirmed:</p>
    <div style="background:#f0fdf4;padding:18px;border-radius:8px;margin:18px 0;border-left:4px solid #10b981;">
      <p style="margin:6px 0;color:#1f2937;"><strong>Room:</strong> ${roomName} ${roomNumber}</p>
      <p style="margin:6px 0;color:#1f2937;"><strong>Location:</strong> ${building}, ${floor}</p>
      <p style="margin:6px 0;color:#1f2937;"><strong>Date:</strong> ${booking.date}</p>
      <p style="margin:6px 0;color:#1f2937;"><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</p>
      <p style="margin:6px 0;color:#1f2937;"><strong>Purpose:</strong> ${booking.purpose}</p>
      ${booking.comment ? `<p style="margin:6px 0;color:#1f2937;"><strong>Notes:</strong> ${booking.comment}</p>` : ''}
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-bottom:0;">NIT Raipur — Room Allocation System</p>
  </div>`;

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await transporter.sendMail({
        from: `NITRR Room Allocation <${getFromAddress()}>`,
        to: booking.facultyEmail,
        subject: `✅ Booking Confirmed: ${roomName} (${booking.date})`,
        html,
      });
      console.log(`✅ Confirmation email sent to ${booking.facultyEmail}`);
    } catch (err) {
      console.error(`❌ Failed to send confirmation email to ${booking.facultyEmail}:`, err.message);
    }
  }
};

/**
 * Send booking cancellation email
 * @param {Object} booking - Booking document (with populated roomId)
 * @param {string} reason - Cancellation reason
 */
exports.sendBookingCancellationEmail = async (booking, reason) => {
  const roomName = booking.roomId?.name || 'Classroom';
  const roomNumber = booking.roomId?.roomNumber ? `(${booking.roomId.roomNumber})` : '';

  const html = `
  <div style="font-family:Arial, sans-serif;max-width:520px;margin:40px auto;background:#ffffff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);border:1px solid #e2e8f0;">
    <h2 style="color:#dc2626;text-align:center;margin-top:0;">❌ Booking Cancelled</h2>
    <p style="color:#374151;font-size:15px;">Dear <strong>${booking.facultyName}</strong>,</p>
    <p style="color:#4b5563;font-size:14px;">Your scheduled room reservation has been cancelled:</p>
    <div style="background:#fef2f2;padding:18px;border-radius:8px;margin:18px 0;border-left:4px solid #ef4444;">
      <p style="margin:6px 0;color:#1f2937;"><strong>Room:</strong> ${roomName} ${roomNumber}</p>
      <p style="margin:6px 0;color:#1f2937;"><strong>Date:</strong> ${booking.date}</p>
      <p style="margin:6px 0;color:#1f2937;"><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</p>
      <p style="margin:6px 0;color:#b91c1c;"><strong>Reason:</strong> ${reason || 'Schedule adjustment by Department HOD'}</p>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-bottom:0;">NIT Raipur — Room Allocation System</p>
  </div>`;

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      await transporter.sendMail({
        from: `NITRR Room Allocation <${getFromAddress()}>`,
        to: booking.facultyEmail,
        subject: `❌ Booking Cancelled: ${roomName} (${booking.date})`,
        html,
      });
      console.log(`✅ Cancellation email sent to ${booking.facultyEmail}`);
    } catch (err) {
      console.error(`❌ Failed to send cancellation email to ${booking.facultyEmail}:`, err.message);
    }
  }
};