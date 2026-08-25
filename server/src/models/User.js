const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    index: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false,
    validate: {
      validator: function(v) {
        // At least one number and one letter
        return /^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(v);
      },
      message: 'Password must contain at least one letter and one number'
    }
  },
  role: {
    type: String,
    enum: ['hod', 'professor'],
    default: 'professor',
    index: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA'],
    index: true
  },
  employeeId: {
    type: String,
    required: [true, 'Employee ID is required'],
    unique: true,
    index: true,
    trim: true,
    uppercase: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: function(v) {
        return /^[0-9]{10}$/.test(v);
      },
      message: 'Phone number must be exactly 10 digits'
    }
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  lastLogin: {
    type: Date,
    default: null
  },
  hodApproval: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  // Additional fields
  profileImage: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    trim: true
  },
  lastActive: {
    type: Date,
    default: null
  },
  preferences: {
    notifications: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light'
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  // Account security
  failedLoginAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  lockedUntil: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// ============================================
// COMPOUND INDEXES
// ============================================

// Fast queries by department and role
UserSchema.index({ department: 1, role: 1 });

// Fast queries for active users
UserSchema.index({ isActive: 1, role: 1 });

// Fast queries for pending approvals
UserSchema.index({ hodApproval: 1, role: 1 });

// ============================================
// VIRTUAL PROPERTIES
// ============================================

UserSchema.virtual('isHOD').get(function() {
  return this.role === 'hod';
});

UserSchema.virtual('isProfessor').get(function() {
  return this.role === 'professor';
});

UserSchema.virtual('isApprovedHOD').get(function() {
  return this.role === 'hod' && this.hodApproval === 'approved';
});

UserSchema.virtual('isPendingHOD').get(function() {
  return this.role === 'hod' && this.hodApproval === 'pending';
});

UserSchema.virtual('fullName').get(function() {
  return this.name;
});

UserSchema.virtual('displayInfo').get(function() {
  return `${this.name} (${this.email})`;
});

// ============================================
// INSTANCE METHODS
// ============================================

// Compare password
UserSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Generate password reset token
UserSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpires = Date.now() + 3600000; // 1 hour
  return resetToken;
};

// Check if account is locked
UserSchema.methods.isLocked = function() {
  if (!this.lockedUntil) return false;
  return this.lockedUntil > new Date();
};

// Increment failed login attempts
UserSchema.methods.incrementFailedAttempts = async function() {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }
  await this.save();
  return this.failedLoginAttempts;
};

// Reset failed login attempts
UserSchema.methods.resetFailedAttempts = async function() {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  await this.save();
};

// Update last login
UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  this.lastActive = new Date();
  await this.save();
};

// Update profile
UserSchema.methods.updateProfile = async function(data) {
  const allowed = ['name', 'phone', 'bio', 'profileImage', 'preferences'];
  Object.keys(data).forEach(key => {
    if (allowed.includes(key)) {
      this[key] = data[key];
    }
  });
  await this.save();
  return this;
};

// Soft delete account
UserSchema.methods.softDelete = async function() {
  this.isActive = false;
  this.email = `${this.email}_deleted_${Date.now()}`;
  await this.save();
};

// ============================================
// STATIC METHODS
// ============================================

// Find by email with password
UserSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email }).select('+password');
};

// Find active users by role
UserSchema.statics.findActiveByRole = function(role) {
  return this.find({ role, isActive: true }).select('-password');
};

// Find pending HODs
UserSchema.statics.findPendingHODs = function() {
  return this.find({
    role: 'hod',
    hodApproval: 'pending',
    isActive: true
  }).select('-password');
};

// Find approved HODs
UserSchema.statics.findApprovedHODs = function() {
  return this.find({
    role: 'hod',
    hodApproval: 'approved',
    isActive: true
  }).select('-password');
};

// Find professors by department
UserSchema.statics.findProfessorsByDepartment = function(department) {
  return this.find({
    role: 'professor',
    department,
    isActive: true
  }).select('-password');
};

// Get user statistics
UserSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$role',
        total: { $sum: 1 },
        active: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        verified: {
          $sum: { $cond: [{ $eq: ['$isEmailVerified', true] }, 1, 0] }
        },
        departments: {
          $addToSet: '$department'
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  return stats;
};

// Create user with validation
UserSchema.statics.createUser = async function(userData) {
  const existingEmail = await this.findOne({ email: userData.email });
  if (existingEmail) {
    throw new Error('Email already exists');
  }

  const existingEmployeeId = await this.findOne({ employeeId: userData.employeeId });
  if (existingEmployeeId) {
    throw new Error('Employee ID already exists');
  }

  return this.create(userData);
};

// ============================================
// MIDDLEWARE
// ============================================

// Hash password before saving
UserSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Set employeeId to uppercase
UserSchema.pre('save', function(next) {
  if (this.employeeId) {
    this.employeeId = this.employeeId.toUpperCase().trim();
  }
  next();
});

// // Ensure password is not returned in queries
// UserSchema.pre(/^find/, function(next) {
//   this.select('-password');
//   next();
// });

// ============================================
// TO JSON TRANSFORM
// ============================================

UserSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;
    delete ret.failedLoginAttempts;
    delete ret.lockedUntil;
    return ret;
  }
});

UserSchema.set('toObject', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;
    delete ret.failedLoginAttempts;
    delete ret.lockedUntil;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
