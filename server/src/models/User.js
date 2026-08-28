const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@(gmail\.com|([a-zA-Z0-9-]+\.)*nitrr\.ac\.in)$/,
        'Please provide a valid @gmail.com or @nitrr.ac.in email address',
      ],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false,
    },
    role: {
      type: String,
      enum: ['FACULTY', 'HOD'],
      required: true,
      default: 'FACULTY',
      index: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// High-Performance Query Index
UserSchema.index({ department: 1, role: 1 });

// 🔒 ATOMIC SINGLE-HOD CONSTRAINT: Enforces exactly 1 active HOD per department at the database level
UserSchema.index(
  { department: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { role: 'HOD', isActive: true },
  }
);

// Bcrypt password hashing pre-save hook
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Password verification method
UserSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Update last login timestamp without revalidating password
UserSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  return await this.save({ validateModifiedOnly: true });
};

// Static helper to validate email domain
UserSchema.statics.isValidEmail = function (email) {
  if (!email || typeof email !== 'string') return false;
  const regex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|([a-zA-Z0-9-]+\.)*nitrr\.ac\.in)$/i;
  return regex.test(email.trim().toLowerCase());
};

// Static helper to detect default role
UserSchema.statics.detectRole = function (email) {
  if (!email || typeof email !== 'string') return 'FACULTY';
  const normalized = email.trim().toLowerCase();
  const [localPart, domain] = normalized.split('@');

  // Detect HOD designations via local prefix or departmental head addresses
  if (
    localPart.startsWith('hod.') ||
    localPart.startsWith('head.') ||
    localPart === 'hod' ||
    localPart.includes('hod') ||
    domain === 'cse.nitrr.ac.in'
  ) {
    return 'HOD';
  }

  return 'FACULTY';
};

// Transform _id to id and remove password on JSON serialization
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});

// Transform _id to id and remove password on Object serialization
UserSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);