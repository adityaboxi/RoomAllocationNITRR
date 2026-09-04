const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const AdminUserSchema = new mongoose.Schema({
  name: { type: String, default: 'System Admin' },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, default: 'ADMIN' },
  department: { type: String, default: 'ALL' },
  isActive: { type: Boolean, default: true },
  
  // Forces the admin to change their password on first login
  isFirstLogin: { type: Boolean, default: true },
  
  // Forget password fields
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  
  lastLogin: Date
}, { timestamps: true });

AdminUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;
  const salt = await bcrypt.genSalt(saltRounds);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

AdminUserSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

AdminUserSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  return await this.save({ validateModifiedOnly: true });
};

// Generate Reset Password Token
AdminUserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex');
  
  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  
  // Set expire (10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  
  return resetToken;
};

// Transform for JSON
AdminUserSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('AdminUser', AdminUserSchema);



