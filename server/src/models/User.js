const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@nitrr\.ac\.in$/, 'Please use a valid @nitrr.ac.in email']
  },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['FACULTY', 'HOD'], required: true },
  department: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

UserSchema.statics.isValidEmail = function(email) {
  return /^[a-zA-Z0-9._%+-]+@nitrr\.ac\.in$/.test(email);
};

UserSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model('User', UserSchema);
