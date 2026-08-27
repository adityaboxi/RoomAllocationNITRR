const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: {
    type: String, required: true, unique: true, lowercase: true, trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@gmail\.com$/, 'Only @gmail.com emails allowed for testing']
  },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['FACULTY', 'HOD'], required: true },
  department: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
}, { timestamps: true });

// Disable bcrypt hashing for testing
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  // this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Replace bcrypt.compare with plain text comparison for testing
UserSchema.methods.comparePassword = async function(password) {
  // return await bcrypt.compare(password, this.password);
  return this.password === password;
};

UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

UserSchema.statics.isValidEmail = function(email) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
};

UserSchema.statics.detectRole = function(email) {
  const localPart = email.split('@')[0];
  if (localPart.startsWith('hod.') || localPart.startsWith('head.') || localPart === 'hod') return 'HOD';
  return 'FACULTY';
};

UserSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);