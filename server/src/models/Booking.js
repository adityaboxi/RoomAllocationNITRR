const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true, index: true },
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], required: true, index: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: String, required: true },
  comment: { type: String, default: 'No comment provided' },
  status: { type: String, enum: ['active', 'cancelled', 'completed', 'conflict'], default: 'active', index: true },
  department: { type: String, required: true, index: true },
  conflictMessage: { type: String, default: '' },
  notified: { type: Boolean, default: false },
  lockId: { type: String, index: true },
  lockedAt: { type: Date }
}, { timestamps: true });

BookingSchema.index({ room: 1, date: 1, startTime: 1, endTime: 1 }, { unique: true });
BookingSchema.index({ professor: 1, date: 1, status: 1 });
BookingSchema.index({ status: 1, date: 1 });
BookingSchema.index({ lockedAt: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model('Booking', BookingSchema);
