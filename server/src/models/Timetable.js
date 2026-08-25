const mongoose = require('mongoose');

const TimetableSchema = new mongoose.Schema({
  department: {
    type: String,
    required: true,
    enum: ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA'],
    index: true
  },
  semester: {
    type: String,
    required: true,
    enum: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'],
    index: true
  },
  section: {
    type: String,
    enum: ['A', 'B', 'C', 'D'],
    required: true,
    index: true
  },
  day: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    index: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  professor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  version: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

TimetableSchema.index({ department: 1, semester: 1, section: 1, day: 1 });
TimetableSchema.index({ room: 1, day: 1, startTime: 1, endTime: 1 });
TimetableSchema.index({ professor: 1, day: 1 });

module.exports = mongoose.model('Timetable', TimetableSchema);
