const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: {
    type: String, required: true, unique: true, lowercase: true, trim: true,
    // Allow both @gmail.com and @cse.nitrr.ac.in
    match: [
      /^[a-zA-Z0-9._%+-]+@(gmail\.com|cse\.nitrr\.ac\.in)$/,
      'Please use a valid @gmail.com or @cse.nitrr.ac.in email'
    ]
  },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['FACULTY', 'HOD'], required: true },
  department: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
}, { timestamps: true });

// 🔧 ENABLED: bcrypt hashing for password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 🔧 ENABLED: bcrypt comparison for login
UserSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

// ---------- detectRole based on domain ----------
UserSchema.statics.isValidEmail = function(email) {
  return /^[a-zA-Z0-9._%+-]+@(gmail\.com|cse\.nitrr\.ac\.in)$/.test(email);
};

UserSchema.statics.detectRole = function(email) {
  const domain = email.split('@')[1];
  if (domain === 'cse.nitrr.ac.in') return 'HOD';
  if (domain === 'gmail.com') return 'FACULTY';
  return 'FACULTY'; // fallback
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