const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  date: { type: String, required: true },
  day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  facultyName: { type: String, required: true, trim: true },
  facultyEmail: { type: String, required: true, trim: true },
  purpose: { type: String, required: true, trim: true },
  comment: { type: String, default: 'No comment provided' },
  department: { type: String, required: true },
  status: { type: String, enum: ['active','cancelled','completed','conflict'], default: 'active' },
  conflictMessage: { type: String, default: '' },
  lockId: { type: String, sparse: true },
  lockedAt: { type: Date },
  notified: { type: Boolean, default: false }
}, { timestamps: true });

BookingSchema.index({ roomId: 1, date: 1, startTime: 1, endTime: 1 }, { unique: true });
BookingSchema.index({ lockedAt: 1 }, { expireAfterSeconds: 300 });

BookingSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Booking', BookingSchema);