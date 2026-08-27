const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['booking-cancelled', 'booking-confirmed', 'timetable-updated'], default: 'booking-cancelled' },
  read: { type: Boolean, default: false },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);