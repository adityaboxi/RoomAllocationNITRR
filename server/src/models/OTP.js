const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['signup', 'forgot'], default: 'signup' },
  // Keep expiresAt for TTL auto-deletion (OTPs expire after 5 minutes)
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 5 * 60 * 1000) }
}, { timestamps: true });

// TTL index – automatically deletes documents after expiresAt
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', OTPSchema);