const mongoose = require('mongoose');

const TimetableHistorySchema = new mongoose.Schema(
  {
    originalId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    day: {
      type: String,
      required: true,
      index: true,
    },
    startTime: String,
    endTime: String,
    subject: String,
    classGroup: String,
    faculty: String,
    facultyEmail: String,
    semester: String,
    section: String,
    department: {
      type: String,
      index: true,
    },
    validFrom: {
      type: Date,
      required: true,
      index: true,
    },
    validTo: {
      type: Date,
      default: null,
      index: true,
    },
    action: {
      type: String, // 'CREATED', 'UPDATED', 'DELETED', 'UPLOADED'
      default: 'ARCHIVED'
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// High-Performance Query Index for Reports
TimetableHistorySchema.index({ validFrom: 1, validTo: 1 });
TimetableHistorySchema.index({ department: 1, validFrom: 1 });

module.exports = mongoose.model('TimetableHistory', TimetableHistorySchema);
