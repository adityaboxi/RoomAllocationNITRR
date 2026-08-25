const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

/**
 * Enhanced Email Service with:
 * - Connection pooling
 * - Retry logic with exponential backoff
 * - Email templates
 * - Queue system
 * - Fallback SMTP
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConnected = false;
    this.queue = [];
    this.isProcessing = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    
    this.init();
  }

  /**
   * Initialize email transporter
   */
  init() {
    const config = {
      host: process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || 587),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || process.env.FROM_EMAIL || process.env.SMTP_USER,
        pass: process.env.EMAIL_PASS || process.env.SMTP_PASS,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 10,
      rateDelta: 1000,
    };

    // Use secondary SMTP if primary fails
    if (process.env.EMAIL_FAILOVER_HOST) {
      this.fallbackConfig = {
        host: process.env.EMAIL_FAILOVER_HOST,
        port: parseInt(process.env.EMAIL_FAILOVER_PORT) || 587,
        secure: process.env.EMAIL_FAILOVER_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_FAILOVER_USER,
          pass: process.env.EMAIL_FAILOVER_PASS,
        },
      };
    }

    this.transporter = nodemailer.createTransport(config);
    this.verifyConnection();
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      this.isConnected = true;
      logger.info('✅ Email service connected successfully');
    } catch (error) {
      this.isConnected = false;
      logger.error(`❌ Email service connection failed: ${error.message}`);
      
      // Try fallback if available
      if (this.fallbackConfig) {
        logger.info('🔄 Trying fallback SMTP...');
        try {
          this.transporter = nodemailer.createTransport(this.fallbackConfig);
          await this.transporter.verify();
          this.isConnected = true;
          logger.info('✅ Fallback email service connected');
        } catch (fallbackError) {
          logger.error(`❌ Fallback email service failed: ${fallbackError.message}`);
        }
      }
    }
  }

  /**
   * Send email with retry logic
   */
  async sendEmail(mailOptions, retries = 0) {
    try {
      if (!this.isConnected) {
        await this.verifyConnection();
        if (!this.isConnected) {
          throw new Error('Email service is not connected');
        }
      }

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`📧 Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`❌ Email send failed: ${error.message}`);
      
      // Retry with exponential backoff
      if (retries < this.maxRetries) {
        const delay = Math.pow(2, retries) * 1000;
        logger.info(`🔄 Retrying email in ${delay}ms (Attempt ${retries + 1}/${this.maxRetries})`);
        
        await this.sleep(delay);
        return this.sendEmail(mailOptions, retries + 1);
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Queue email for sending
   */
  queueEmail(mailOptions) {
    return new Promise((resolve) => {
      this.queue.push({
        mailOptions,
        resolve,
        timestamp: Date.now()
      });
      
      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process email queue
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      
      // Rate limit: 10 emails per second
      const now = Date.now();
      if (this.lastEmailTime && (now - this.lastEmailTime) < 100) {
        await this.sleep(100);
      }
      
      const result = await this.sendEmail(job.mailOptions);
      job.resolve(result);
      this.lastEmailTime = Date.now();
    }
    
    this.isProcessing = false;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // EMAIL TEMPLATES
  // ============================================

  /**
   * Send OTP email
   */
  async sendOTPEmail(email, otp, purpose = 'signup') {
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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f7fc; margin: 0; padding: 0; }
          .container { max-width: 550px; margin: 40px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); overflow: hidden; }
          .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px 20px; text-align: center; }
          .header h1 { color: #ffffff; font-size: 24px; margin: 0; }
          .body { padding: 35px 30px; }
          .otp-box { background: #eff6ff; border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; border: 2px dashed #3b82f6; }
          .otp-code { font-size: 40px; font-weight: 700; color: #1e40af; letter-spacing: 8px; font-family: 'Courier New', monospace; }
          .footer { background: #f8fafc; padding: 20px 30px; text-align: center; }
          .footer p { color: #9ca3af; font-size: 12px; margin: 3px 0; }
          .warning { color: #dc2626; font-size: 13px; text-align: center; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏫 NITRR Room Allocation</h1>
            <p>${title}</p>
          </div>
          <div class="body">
            <p>Hello,</p>
            <p>${message}</p>
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
              <div style="font-size: 13px; color: #6b7280; margin-top: 5px;">
                This OTP is valid for <strong>10 minutes</strong>
              </div>
            </div>
            <div class="warning">⚠️ Do not share this OTP with anyone.</div>
          </div>
          <div class="footer">
            <p>© 2024 NIT Raipur - Room Allocation System</p>
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
      to: email,
      subject,
      html
    };

    return this.sendEmail(mailOptions);
  }

  /**
   * Send HOD approval email
   */
  async sendHODApprovalEmail(user, status, adminName) {
    const isApproved = status === 'approved';
    const subject = isApproved 
      ? '✅ HOD Account Approved - NITRR Room Allocation'
      : '❌ HOD Account Rejected - NITRR Room Allocation';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f7fc; margin: 0; padding: 0; }
          .container { max-width: 550px; margin: 40px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); overflow: hidden; }
          .header { background: ${isApproved ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, #dc2626, #ef4444)'}; padding: 30px 20px; text-align: center; }
          .header h1 { color: #ffffff; font-size: 24px; margin: 0; }
          .body { padding: 35px 30px; }
          .box { background: ${isApproved ? '#ecfdf5' : '#fef2f2'}; border-radius: 12px; padding: 25px; text-align: center; border: 2px solid ${isApproved ? '#10b981' : '#ef4444'}; }
          .box .icon { font-size: 48px; }
          .box h2 { color: ${isApproved ? '#059669' : '#dc2626'}; margin: 10px 0 5px; }
          .footer { background: #f8fafc; padding: 20px 30px; text-align: center; }
          .button { display: inline-block; background: #3b82f6; color: #ffffff; padding: 12px 30px; border-radius: 8px; text-decoration: none; margin-top: 15px; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isApproved ? '✅ HOD Account Approved' : '❌ HOD Account Rejected'}</h1>
          </div>
          <div class="body">
            <p>Dear <strong>${user.name}</strong>,</p>
            <div class="box">
              <div class="icon">${isApproved ? '🎉' : '😔'}</div>
              <h2>${isApproved ? 'Congratulations!' : 'Request Rejected'}</h2>
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                ${isApproved 
                  ? `Your HOD account has been approved by <strong>${adminName}</strong>. You can now login and access HOD features.`
                  : `Your HOD account request has been rejected by <strong>${adminName}</strong>. Please contact the administrator for more information.`
                }
              </p>
            </div>
            ${isApproved ? `
              <div style="text-align: center; margin-top: 20px;">
                <a href="http://localhost:5173" class="button">Login to Dashboard</a>
              </div>
            ` : ''}
          </div>
          <div class="footer">
            <p>© 2024 NIT Raipur - Room Allocation System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
      to: user.email,
      subject,
      html
    };

    return this.sendEmail(mailOptions);
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(professor, booking) {
    const roomNumber = booking.room?.roomNumber || booking.room || 'N/A';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f7fc; margin: 0; padding: 0; }
          .container { max-width: 550px; margin: 40px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); overflow: hidden; }
          .header { background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 30px 20px; text-align: center; }
          .header h1 { color: #ffffff; font-size: 24px; margin: 0; }
          .body { padding: 35px 30px; }
          .details { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 15px 0; }
          .details-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
          .details-row:last-child { border-bottom: none; }
          .details-label { color: #6b7280; font-size: 13px; }
          .details-value { color: #1f2937; font-weight: 600; font-size: 14px; }
          .footer { background: #f8fafc; padding: 20px 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Booking Confirmed</h1>
          </div>
          <div class="body">
            <p>Dear <strong>${professor.name}</strong>,</p>
            <p>Your extra class booking has been confirmed.</p>
            <div class="details">
              <div class="details-row">
                <span class="details-label">Room</span>
                <span class="details-value">${roomNumber}</span>
              </div>
              <div class="details-row">
                <span class="details-label">Date</span>
                <span class="details-value">${new Date(booking.date).toLocaleDateString()}</span>
              </div>
              <div class="details-row">
                <span class="details-label">Time</span>
                <span class="details-value">${booking.startTime} - ${booking.endTime}</span>
              </div>
              <div class="details-row">
                <span class="details-label">Subject</span>
                <span class="details-value">${booking.subject}</span>
              </div>
              ${booking.comment && booking.comment !== 'No comment provided' ? `
              <div class="details-row">
                <span class="details-label">Comment</span>
                <span class="details-value">${booking.comment}</span>
              </div>` : ''}
            </div>
            <p style="font-size: 13px; color: #6b7280; margin-top: 15px;">
              ⚠️ If HOD updates the timetable, your booking may be auto-cancelled if there's a conflict.
            </p>
          </div>
          <div class="footer">
            <p>© 2024 NIT Raipur - Room Allocation System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
      to: professor.email,
      subject: '✅ Booking Confirmed - NITRR Room Allocation',
      html
    };

    return this.sendEmail(mailOptions);
  }

  /**
   * Send cancellation notification email
   */
  async sendCancellationNotification(professor, cancelledBookings) {
    const bookingsList = cancelledBookings.map((booking, index) => {
      const roomNumber = booking.room?.roomNumber || booking.room || 'N/A';
      return `
      <tr style="background: ${index % 2 === 0 ? '#f8fafc' : '#ffffff'}">
        <td style="padding: 10px; border: 1px solid #e5e7eb;">${roomNumber}</td>
        <td style="padding: 10px; border: 1px solid #e5e7eb;">${new Date(booking.date).toLocaleDateString()}</td>
        <td style="padding: 10px; border: 1px solid #e5e7eb;">${booking.startTime} - ${booking.endTime}</td>
        <td style="padding: 10px; border: 1px solid #e5e7eb;">${booking.subject}</td>
        <td style="padding: 10px; border: 1px solid #e5e7eb; color: #dc2626; font-size: 12px;">${booking.conflictMessage || 'Timetable conflict'}</td>
      </tr>
    `}).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Cancellation</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f7fc; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); overflow: hidden; }
          .header { background: linear-gradient(135deg, #dc2626, #ef4444); padding: 30px 20px; text-align: center; }
          .header h1 { color: #ffffff; font-size: 24px; margin: 0; }
          .body { padding: 35px 30px; }
          .table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
          .table th { background: #1f2937; color: #ffffff; padding: 10px; text-align: left; font-weight: 600; }
          .table td { padding: 10px; border: 1px solid #e5e7eb; }
          .footer { background: #f8fafc; padding: 20px 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Booking Cancelled</h1>
          </div>
          <div class="body">
            <p>Dear <strong>${professor.name}</strong>,</p>
            <p style="color: #dc2626; font-weight: 600;">Your extra class booking(s) have been cancelled due to a timetable update.</p>
            <table class="table">
              <thead>
                <tr><th>Room</th><th>Date</th><th>Time</th><th>Subject</th><th>Reason</th></tr>
              </thead>
              <tbody>${bookingsList}</tbody>
            </table>
            <p style="margin-top: 15px;">Please login to book an alternate room.</p>
          </div>
          <div class="footer">
            <p>© 2024 NIT Raipur - Room Allocation System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
      to: professor.email,
      subject: '❌ Booking Cancelled - NITRR Room Allocation',
      html
    };

    return this.sendEmail(mailOptions);
  }

  /**
   * Send password reset success email
   */
  async sendPasswordResetSuccessEmail(email, name) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Successful</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f7fc; margin: 0; padding: 0; }
          .container { max-width: 550px; margin: 40px auto; background: #ffffff; border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); overflow: hidden; }
          .header { background: linear-gradient(135deg, #059669, #10b981); padding: 30px 20px; text-align: center; }
          .header h1 { color: #ffffff; font-size: 24px; margin: 0; }
          .body { padding: 35px 30px; }
          .success-box { background: #ecfdf5; border-radius: 12px; padding: 25px; text-align: center; border: 2px solid #10b981; }
          .footer { background: #f8fafc; padding: 20px 30px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Password Reset Successful</h1>
          </div>
          <div class="body">
            <p>Dear <strong>${name}</strong>,</p>
            <div class="success-box">
              <div class="icon" style="font-size: 48px;">🔐</div>
              <h2 style="color: #059669; margin: 10px 0 5px;">Password Reset Successful</h2>
              <p style="color: #6b7280; font-size: 14px;">Your password has been successfully reset.</p>
            </div>
            <p style="margin-top: 20px;">
              If you did not request this password reset, please contact support immediately.
            </p>
          </div>
          <div class="footer">
            <p>© 2024 NIT Raipur - Room Allocation System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@nitrr.ac.in',
      to: email,
      subject: '✅ Password Reset Successful - NITRR Room Allocation',
      html
    };

    return this.sendEmail(mailOptions);
  }
}

// Singleton instance
const emailService = new EmailService();

module.exports = {
  emailService,
  // Legacy exports (for backward compatibility)
  sendOTPEmail: (email, otp, purpose) => emailService.sendOTPEmail(email, otp, purpose),
  sendHODApprovalEmail: (user, status, adminName) => emailService.sendHODApprovalEmail(user, status, adminName),
  sendBookingConfirmation: (professor, booking) => emailService.sendBookingConfirmation(professor, booking),
  sendCancellationNotification: (professor, cancelledBookings) => emailService.sendCancellationNotification(professor, cancelledBookings),
  sendPasswordResetSuccessEmail: (email, name) => emailService.sendPasswordResetSuccessEmail(email, name)
};
