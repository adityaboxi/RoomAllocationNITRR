const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  facultyName: { type: String, required: true, trim: true },
  facultyEmail: { type: String, required: true, trim: true },
  purpose: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active' },
}, { timestamps: true });

BookingSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Booking', BookingSchema);
