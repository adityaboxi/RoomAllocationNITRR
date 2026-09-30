const nodemailer = require('nodemailer');

const isLoggingOnly = process.env.ENABLE_EMAIL_LOGGING_ONLY === 'true';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

let transporter = null;

if (smtpUser && smtpPass && !isLoggingOnly) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    pool: true,
    maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS, 10),
    maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES, 10),
  });
}

const getSenderAddress = () => {
  const fromName = process.env.FROM_NAME;
  const fromEmail = process.env.FROM_EMAIL;
  return `"${fromName}" <${fromEmail}>`;
};

// ---------- SEND OTP EMAIL ----------
exports.sendOTPEmail = async (email, otp, purpose = 'forgot') => {
  const subject =
    purpose === 'forgot'
      ? 'NIT Raipur: Password Reset OTP'
      : 'NIT Raipur: Account Verification OTP';

  const expiryMin = parseInt(process.env.OTP_EXPIRY_MINUTES, 10);

  const html = `
  <div style="font-family:Arial, sans-serif;max-width:500px;margin:30px auto;background:#ffffff;padding:30px;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
    <div style="text-align:center;margin-bottom:20px;">
      <h2 style="color:#0f172a;margin:0;font-size:22px;font-weight:800;">🏫 NIT Raipur</h2>
      <p style="color:#64748b;font-size:13px;margin-top:4px;">Department Room Allocation System</p>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;text-align:center;border-radius:12px;margin:20px 0">
      <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${subject}</div>
      <span style="font-size:36px;font-weight:900;color:#4f46e5;letter-spacing:8px;font-family:monospace;">${otp}</span>
    </div>
    <p style="text-align:center;color:#475569;font-size:13px;margin:10px 0;">This code is valid for <strong>${expiryMin} minutes</strong>.</p>
    <p style="text-align:center;color:#dc2626;font-size:12px;margin:0;">⚠️ Do not share this code with anyone.</p>
    <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0 16px 0;" />
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:0;">National Institute of Technology Raipur — Automated Dispatch</p>
  </div>`;

  if (!transporter || isLoggingOnly) {
    // console.log(`\n📧 [EMAIL SIMULATION] To: ${email} | Subject: ${subject} | OTP: ${otp}`);
    return;
  }

  console.log(`🔑 [DEV-OTP-LOG] Generated OTP for ${email}: [36m${otp}[0m`);

  try {
    await transporter.sendMail({
      from: getSenderAddress(),
      to: email,
      subject,
      html,
    });
    console.log(`📧 [EMAIL] Dispatched OTP email to: ${email}`);
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Failed sending OTP to ${email}:`, error.message);
  }
};

// ---------- SEND BOOKING CONFIRMATION EMAIL ----------
exports.sendBookingConfirmationEmail = async (booking) => {
  if (!booking?.facultyEmail) return;

  const roomName = booking.roomId?.name || 'Classroom';
    const building = booking.roomId?.building || 'Main Campus';
  const floor = booking.roomId?.floor || 'Ground Floor';

  const html = `
  <div style="font-family:Arial, sans-serif;max-width:540px;margin:30px auto;background:#ffffff;padding:30px;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
    <div style="text-align:center;margin-bottom:20px;">
      <h2 style="color:#059669;margin:0;font-size:22px;font-weight:800;">✅ Reservation Confirmed</h2>
      <p style="color:#64748b;font-size:13px;margin-top:4px;">NIT Raipur Room Allocation</p>
    </div>
    <p style="color:#1e293b;font-size:14px;line-height:1.5;">Dear <strong>${booking.facultyName}</strong>,</p>
    <p style="color:#475569;font-size:13px;margin-top:0;">Your classroom reservation request has been registered successfully:</p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:18px;border-radius:12px;margin:18px 0;font-size:13px;color:#166534;line-height:1.7;">
      <div><strong>Room:</strong> ${roomName}</div>
      <div><strong>Location:</strong> ${building}, ${floor}</div>
      <div><strong>Date:</strong> ${booking.date} (${booking.day})</div>
      <div><strong>Time Slot:</strong> ${booking.startTime} - ${booking.endTime}</div>
      <div><strong>Purpose:</strong> ${booking.purpose}</div>
      ${booking.comment && booking.comment !== 'No comment provided' ? `<div><strong>Notes:</strong> ${booking.comment}</div>` : ''}
    </div>
    <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0 16px 0;" />
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:0;">National Institute of Technology Raipur — Academic Scheduling</p>
  </div>`;

  if (!transporter || isLoggingOnly) {
    return;
  }

  try {
    await transporter.sendMail({
      from: getSenderAddress(),
      to: booking.facultyEmail,
      subject: `✅ Booking Confirmed: ${roomName} (${booking.date})`,
      html,
    });
    console.log(`📧 [EMAIL] Booking confirmation sent to ${booking.facultyEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Failed sending booking confirmation to ${booking.facultyEmail}:`, error.message);
  }
};

// ---------- SEND BOOKING CANCELLATION EMAIL ----------
exports.sendBookingCancellationEmail = async (booking, reason) => {
  if (!booking?.facultyEmail) return;

  const roomName = booking.roomId?.name || 'Classroom';
  
  const html = `
  <div style="font-family:Arial, sans-serif;max-width:540px;margin:30px auto;background:#ffffff;padding:30px;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
    <div style="text-align:center;margin-bottom:20px;">
      <h2 style="color:#dc2626;margin:0;font-size:22px;font-weight:800;">❌ Reservation Cancelled</h2>
      <p style="color:#64748b;font-size:13px;margin-top:4px;">NIT Raipur Room Allocation</p>
    </div>
    <p style="color:#1e293b;font-size:14px;line-height:1.5;">Dear <strong>${booking.facultyName}</strong>,</p>
    <p style="color:#475569;font-size:13px;margin-top:0;">Your scheduled reservation has been cancelled:</p>
    <div style="background:#fef2f2;border:1px solid #fecaca;padding:18px;border-radius:12px;margin:18px 0;font-size:13px;color:#991b1b;line-height:1.7;">
      <div><strong>Room:</strong> ${roomName}</div>
      <div><strong>Date:</strong> ${booking.date} (${booking.day})</div>
      <div><strong>Time Slot:</strong> ${booking.startTime} - ${booking.endTime}</div>
      <div><strong>Reason:</strong> ${reason || 'Schedule adjustment'}</div>
    </div>
    <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0 16px 0;" />
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:0;">National Institute of Technology Raipur — Academic Scheduling</p>
  </div>`;

  if (!transporter || isLoggingOnly) {
    return;
  }

  try {
    await transporter.sendMail({
      from: getSenderAddress(),
      to: booking.facultyEmail,
      subject: `❌ Booking Cancelled: ${roomName} on ${booking.date}`,
      html,
    });
    console.log(`📧 [EMAIL] Booking cancellation sent to ${booking.facultyEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Failed sending booking cancellation to ${booking.facultyEmail}:`, error.message);
  }
};

// ---------- SEND BOOKING RESTORATION EMAIL (HOD Mistake Revocation) ----------
exports.sendBookingRestorationEmail = async (booking, holidayTitle) => {
  if (!booking?.facultyEmail) return;

  const roomName = booking.roomId?.name || 'Classroom';
    const building = booking.roomId?.building || 'Main Campus';
  const floor = booking.roomId?.floor || 'Ground Floor';

  const html = `
  <div style="font-family:Arial, sans-serif;max-width:540px;margin:30px auto;background:#ffffff;padding:30px;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
    <div style="text-align:center;margin-bottom:20px;">
      <h2 style="color:#059669;margin:0;font-size:22px;font-weight:800;">🎉 Reservation Reinstated</h2>
      <p style="color:#64748b;font-size:13px;margin-top:4px;">NIT Raipur Room Allocation</p>
    </div>
    <p style="color:#1e293b;font-size:14px;line-height:1.5;">Dear <strong>${booking.facultyName}</strong>,</p>
    <p style="color:#475569;font-size:13px;margin-top:0;">
      The department holiday ("<strong>${holidayTitle}</strong>") on <strong>${booking.date}</strong> was revoked / removed by the Department HOD.
    </p>
    <p style="color:#475569;font-size:13px;">
      Your previously cancelled classroom reservation has been <strong>automatically restored and is now active</strong>.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:18px;border-radius:12px;margin:18px 0;font-size:13px;color:#166534;line-height:1.7;">
      <div><strong>Room:</strong> ${roomName}</div>
      <div><strong>Location:</strong> ${building}, ${floor}</div>
      <div><strong>Date:</strong> ${booking.date} (${booking.day})</div>
      <div><strong>Time Slot:</strong> ${booking.startTime} - ${booking.endTime}</div>
      <div><strong>Purpose:</strong> ${booking.purpose}</div>
      <div><strong>Status:</strong> <span style="background:#22c55e;color:#fff;padding:2px 8px;border-radius:6px;font-weight:bold;font-size:11px;">ACTIVE</span></div>
    </div>
    <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0 16px 0;" />
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:0;">National Institute of Technology Raipur — Academic Scheduling</p>
  </div>`;

  if (!transporter || isLoggingOnly) {
    return;
  }

  try {
    await transporter.sendMail({
      from: getSenderAddress(),
      to: booking.facultyEmail,
      subject: `🎉 Booking Restored: ${roomName} on ${booking.date}`,
      html,
    });
    console.log(`📧 [EMAIL] Booking restoration sent to ${booking.facultyEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Failed sending booking restoration to ${booking.facultyEmail}:`, error.message);
  }
};

// ---------- SEND ROOM DELETED EMAIL (to HOD of that department) ----------
exports.sendRoomDeletedNotificationEmail = async ({ hodEmail, hodName, roomName, building, floor, department, bookingsCancelled, timetableSlotsRemoved }) => {
  if (!hodEmail) return;

  const html = `
  <div style="font-family:Arial, sans-serif;max-width:540px;margin:30px auto;background:#ffffff;padding:30px;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
    <div style="text-align:center;margin-bottom:20px;">
      <h2 style="color:#dc2626;margin:0;font-size:22px;font-weight:800;">🏫 Room Removed from Inventory</h2>
      <p style="color:#64748b;font-size:13px;margin-top:4px;">NIT Raipur — System Administrator Notice</p>
    </div>
    <p style="color:#1e293b;font-size:14px;line-height:1.5;">Dear <strong>${hodName || 'HOD'}</strong>,</p>
    <p style="color:#475569;font-size:13px;margin-top:0;">
      The System Administrator has <strong>permanently removed</strong> the following room from the <strong>${department}</strong> department inventory:
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;padding:18px;border-radius:12px;margin:18px 0;font-size:13px;color:#991b1b;line-height:1.7;">
      <div><strong>Room Name:</strong> ${roomName}</div>
            <div><strong>Building:</strong> ${building || '—'}</div>
      <div><strong>Floor:</strong> ${floor !== undefined ? 'Floor ' + floor : '—'}</div>
    </div>
    <div style="background:#fff7ed;border:1px solid #fed7aa;padding:14px 18px;border-radius:12px;margin:14px 0;font-size:13px;color:#9a3412;line-height:1.7;">
      <div><strong>⚠️ Impact Summary:</strong></div>
      <div>• Timetable slots removed: <strong>${timetableSlotsRemoved || 0}</strong></div>
      <div>• Future bookings cancelled: <strong>${bookingsCancelled || 0}</strong></div>
      <div style="margin-top:6px;font-size:12px;color:#b45309;">All affected faculty members have been individually notified.</div>
    </div>
    <p style="color:#475569;font-size:13px;">Please re-allocate necessary sessions to another room using the HOD portal.</p>
    <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0 16px 0;" />
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:0;">National Institute of Technology Raipur — Academic Scheduling</p>
  </div>`;

  if (!transporter || isLoggingOnly) {
    return;
  }

  try {
    await transporter.sendMail({
      from: getSenderAddress(),
      to: hodEmail,
      subject: `🏫 Admin Action: Room "${roomName}" Removed from ${department} Inventory`,
      html,
    });
    console.log(`📧 [EMAIL] Room deleted notice sent to HOD: ${hodEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Failed sending room deleted notice to ${hodEmail}:`, error.message);
  }
};
// ---------- SEND NOTIFICATION TO HOD ABOUT A BOOKING ----------
exports.sendHODBookingNotificationEmail = async (booking, hodEmail, hodName) => {
  if (!hodEmail) return;

  const roomName = booking.roomId?.name || 'Classroom';
    const building = booking.roomId?.building || 'Main Campus';

  const html = `
  <div style="font-family:Arial, sans-serif;max-width:540px;margin:30px auto;background:#ffffff;padding:30px;border-radius:16px;border:1px solid #e2e8f0;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
    <div style="text-align:center;margin-bottom:20px;">
      <h2 style="color:#0284c7;margin:0;font-size:22px;font-weight:800;">ℹ️ Faculty Booking Alert</h2>
      <p style="color:#64748b;font-size:13px;margin-top:4px;">NIT Raipur Room Allocation</p>
    </div>
    <p style="color:#1e293b;font-size:14px;line-height:1.5;">Dear <strong>${hodName}</strong>,</p>
    <p style="color:#475569;font-size:13px;margin-top:0;">This is to notify you that <strong>${booking.facultyName}</strong> has just booked a room:</p>
    <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:18px;border-radius:12px;margin:18px 0;font-size:13px;color:#075985;line-height:1.7;">
      <div><strong>Room:</strong> ${roomName}</div>
      <div><strong>Date:</strong> ${booking.date} (${booking.day})</div>
      <div><strong>Time Slot:</strong> ${booking.startTime} - ${booking.endTime}</div>
      <div><strong>Purpose:</strong> ${booking.purpose}</div>
    </div>
    <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0 16px 0;" />
    <p style="text-align:center;color:#94a3b8;font-size:11px;margin:0;">National Institute of Technology Raipur — Academic Scheduling</p>
  </div>`;

  if (!transporter || isLoggingOnly) {
    return;
  }

  try {
    await transporter.sendMail({
      from: getSenderAddress(),
      to: hodEmail,
      subject: `ℹ️ Room Booked: ${booking.facultyName} (${booking.date})`,
      html,
    });
    console.log(`📧 [EMAIL] Dispatched HOD Notification email to: ${hodEmail}`);
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Failed sending HOD Notification to ${hodEmail}:`, error.message);
  }
};

exports.sendNewRoomAddedEmail = async ({ hodEmail, hodName, roomName, department, building, floor, capacity, type }) => {
  const subject = `NIT Raipur: New Room Added to ${department} Department`;

  const html = `
  <div style="font-family:Arial, sans-serif;max-width:550px;margin:20px auto;background:#ffffff;padding:30px;border-radius:12px;border:1px solid #e2e8f0;">
    <div style="text-align:center;margin-bottom:24px;">
      <h2 style="color:#0f172a;margin:0;font-size:22px;">🏫 NIT Raipur Room Allocation</h2>
      <p style="color:#64748b;font-size:14px;margin-top:4px;">New Room Assigned to Your Department</p>
    </div>
    
    <p style="color:#334155;font-size:15px;line-height:1.5;">Dear <strong>${hodName}</strong>,</p>
    <p style="color:#334155;font-size:15px;line-height:1.5;">
      The System Administrator has successfully allocated a new room to the <strong>${department}</strong> department. 
      It is now available in your department's inventory.
    </p>

    <div style="background:#f8fafc;padding:20px;border-radius:8px;border:1px solid #e2e8f0;margin:24px 0;">
      <h3 style="margin:0 0 16px 0;font-size:15px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">New Room Details:</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px;color:#475569;">
        <div><strong>Name:</strong> ${roomName}</div>
        <div><strong>Type:</strong> ${type}</div>
        <div><strong>Capacity:</strong> ${capacity} Seats</div>
        <div><strong>Location:</strong> ${building} (${floor})</div>
      </div>
    </div>

    <div style="background:#fff7ed;padding:16px;border-radius:8px;border:1px solid #ffedd5;margin-bottom:24px;text-align:center;">
      <strong style="color:#c2410c;font-size:15px;">Action Required</strong>
      <p style="color:#9a3412;margin:8px 0 0 0;font-size:14px;">
        Please log into the HOD Dashboard to configure this room and upload its official semester timetable. 
        Until a timetable is uploaded, this room cannot be safely booked without potential conflicts!
      </p>
    </div>

    <p style="color:#64748b;font-size:13px;text-align:center;">
      This is an automated notification from the NIT Raipur Room Allocation System.
    </p>
  </div>
  `;

  await sendMail(hodEmail, subject, html);
};
