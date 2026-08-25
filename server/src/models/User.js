const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true, minlength: 6, select: false },
  role: { type: String, enum: ['hod', 'professor'], default: 'professor', index: true },
  department: { type: String, required: true, enum: ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA'], index: true },
  employeeId: { type: String, required: true, unique: true, index: true },
  phone: { type: String, required: true },
  isActive: { type: Boolean, default: true, index: true },
  isEmailVerified: { type: Boolean, default: false },
  lastLogin: Date,
  hodApproval: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  try {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) { next(error); }
});

UserSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', UserSchema);
