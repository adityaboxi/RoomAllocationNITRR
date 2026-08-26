const mongoose = require('mongoose');

const TimetableSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: String, required: true, trim: true },
  classGroup: { type: String, required: true, trim: true },
  faculty: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

TimetableSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Timetable', TimetableSchema);
