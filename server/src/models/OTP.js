const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    index: true
  },
  otp: {
    type: String,
    required: [true, 'OTP is required'],
    length: 6,
    match: [/^\d{6}$/, 'OTP must be exactly 6 digits']
  },
  purpose: {
    type: String,
    enum: ['signup', 'login', 'reset', 'forgot'],
    default: 'signup',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    index: { expiresAfterSeconds: 0 } // Auto-delete when expired
  },
  attempts: {
    type: Number,
    default: 0,
    min: [0, 'Attempts cannot be negative']
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  verified: {
    type: Boolean,
    default: false
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// ============================================
// INDEXES
// ============================================

// Compound index for faster lookups
OTPSchema.index({ email: 1, purpose: 1, verified: 1 });

// TTL index for auto-deletion
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ============================================
// INSTANCE METHODS
// ============================================

// Check if OTP is expired
OTPSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Check if OTP is verified
OTPSchema.methods.isVerified = function() {
  return this.verified === true;
};

// Increment attempts
OTPSchema.methods.incrementAttempts = async function() {
  this.attempts += 1;
  await this.save();
  return this.attempts;
};

// Check if max attempts reached
OTPSchema.methods.hasExceededAttempts = function() {
  return this.attempts >= this.maxAttempts;
};

// Mark as verified
OTPSchema.methods.markVerified = async function() {
  this.verified = true;
  await this.save();
  return this;
};

// Get remaining attempts
OTPSchema.methods.getRemainingAttempts = function() {
  return Math.max(0, this.maxAttempts - this.attempts);
};

// ============================================
// STATIC METHODS
// ============================================

// Create new OTP
OTPSchema.statics.createOTP = async function(email, purpose = 'signup', ipAddress = null, userAgent = null) {
  // Delete existing OTPs for this email and purpose
  await this.deleteMany({ email, purpose });

  // Generate random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Set expiry to 10 minutes from now
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Create new OTP
  const otpDoc = await this.create({
    email,
    otp,
    purpose,
    expiresAt,
    ipAddress,
    userAgent
  });

  return otpDoc;
};

// Verify OTP
OTPSchema.statics.verifyOTP = async function(email, otp, purpose = 'signup') {
  // Find OTP
  const otpDoc = await this.findOne({
    email,
    purpose,
    otp,
    verified: false
  });

  if (!otpDoc) {
    throw new Error('Invalid OTP');
  }

  // Check if expired
  if (otpDoc.isExpired()) {
    await this.deleteOne({ _id: otpDoc._id });
    throw new Error('OTP has expired. Please request a new one.');
  }

  // Check attempts
  if (otpDoc.hasExceededAttempts()) {
    await this.deleteOne({ _id: otpDoc._id });
    throw new Error('Too many failed attempts. Please request a new OTP.');
  }

  // Mark as verified
  await otpDoc.markVerified();

  return otpDoc;
};

// Get valid OTP
OTPSchema.statics.getValidOTP = async function(email, purpose = 'signup') {
  const otpDoc = await this.findOne({
    email,
    purpose,
    verified: false
  });

  if (!otpDoc) {
    return null;
  }

  if (otpDoc.isExpired()) {
    await this.deleteOne({ _id: otpDoc._id });
    return null;
  }

  if (otpDoc.hasExceededAttempts()) {
    await this.deleteOne({ _id: otpDoc._id });
    return null;
  }

  return otpDoc;
};

// Clean up expired OTPs
OTPSchema.statics.cleanupExpired = async function() {
  const result = await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
  return result.deletedCount;
};

// ============================================
// MIDDLEWARE
// ============================================

// Auto-delete after verification or max attempts
OTPSchema.pre('save', function(next) {
  if (this.isNew && this.otp.length !== 6) {
    next(new Error('OTP must be exactly 6 digits'));
  }
  next();
});

// ============================================
// TO JSON TRANSFORM
// ============================================

OTPSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    // Don't expose OTP in responses
    delete ret.otp;
    return ret;
  }
});

OTPSchema.set('toObject', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    // Don't expose OTP in responses
    delete ret.otp;
    return ret;
  }
});

module.exports = mongoose.model('OTP', OTPSchema);
