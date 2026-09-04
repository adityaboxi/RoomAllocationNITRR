const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otp: {
      type: String,
      required: true,
      trim: true,
    },
    purpose: {
      type: String,
      enum: ['signup', 'forgot'],
      default: 'signup',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5) * 60 * 1000),
    },
    userData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// High-Speed Lookup Compound Index for OTP Verification
OTPSchema.index({ email: 1, purpose: 1, otp: 1 });

// Automatic TTL Expiration Index
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', OTPSchema);