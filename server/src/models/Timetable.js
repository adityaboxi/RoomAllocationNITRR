const mongoose = require('mongoose');

const TimetableSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  day: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'], required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: String, required: true, trim: true },
  classGroup: { type: String, required: true, trim: true },
  faculty: { type: String, required: true, trim: true },
  semester: { type: String, enum: ['1st','2nd','3rd','4th','5th','6th','7th','8th'], required: true },
  section: { type: String, enum: ['A','B','C','D'], required: true },
  department: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

TimetableSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Timetable', TimetableSchema);