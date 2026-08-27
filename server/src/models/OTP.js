const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['signup', 'forgot'], default: 'signup' },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 5 * 60 * 1000) },
  userData: { type: Object, default: null }, // stores signup data temporarily
}, { timestamps: true });

OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', OTPSchema);