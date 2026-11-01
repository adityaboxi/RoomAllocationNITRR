const mongoose = require('mongoose');
const { getReportConnection } = require('../config/reportDb');

// ---------- REPORT BOOKING ARCHIVE SCHEMA ----------
const ReportBookingSchema = new mongoose.Schema(
  {
    originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, index: true },
    roomName: { type: String, required: true, index: true },
    building: { type: String, default: '-' },
    floor: { type: String, default: '-' },
    capacity: { type: Number, default: 0 },
    roomType: { type: String, default: 'Classroom' },
    department: { type: String, required: true, index: true },
    facultyName: { type: String, required: true, index: true },
    facultyEmail: { type: String, required: true, index: true },
    date: { type: String, required: true, index: true }, // 'YYYY-MM-DD'
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    purpose: { type: String, default: 'General' },
    comment: { type: String, default: '' },
    status: { type: String, default: 'completed', index: true },
    isArchivedAfter30Days: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ReportBookingSchema.index({ date: 1, department: 1 });
ReportBookingSchema.index({ date: 1, roomId: 1 });
ReportBookingSchema.index({ department: 1, status: 1 });
ReportBookingSchema.index({ facultyEmail: 1, date: 1 });

// ---------- REPORT TIMETABLE ARCHIVE SCHEMA ----------
const ReportTimetableSchema = new mongoose.Schema(
  {
    originalId: { type: mongoose.Schema.Types.ObjectId, index: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, index: true },
    roomName: { type: String, required: true, index: true },
    building: { type: String, default: '-' },
    floor: { type: String, default: '-' },
    department: { type: String, required: true, index: true },
    semester: { type: String, required: true, index: true },
    section: { type: String, default: 'A' },
    day: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    subject: { type: String, required: true },
    classGroup: { type: String, default: '' },
    faculty: { type: String, required: true },
    facultyEmail: { type: String, default: '' },
    archivedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ReportTimetableSchema.index({ department: 1, semester: 1, day: 1 });
ReportTimetableSchema.index({ roomId: 1, day: 1 });

// ---------- REPORT SYNC METADATA SCHEMA ----------
const ReportSyncMetaSchema = new mongoose.Schema(
  {
    syncType: { type: String, default: '30_DAY_CYCLE' },
    syncedBookingsCount: { type: Number, default: 0 },
    syncedTimetablesCount: { type: Number, default: 0 },
    lastSyncTimestamp: { type: Date, default: Date.now },
    status: { type: String, default: 'SUCCESS' },
    message: { type: String, default: '' },
  },
  { timestamps: true }
);

/**
 * Returns model instances attached to the dedicated report database connection
 */
const getReportModels = () => {
  const conn = getReportConnection();
  if (!conn) return null;

  const ReportBooking = conn.models.ReportBooking || conn.model('ReportBooking', ReportBookingSchema);
  const ReportTimetable = conn.models.ReportTimetable || conn.model('ReportTimetable', ReportTimetableSchema);
  const ReportSyncMeta = conn.models.ReportSyncMeta || conn.model('ReportSyncMeta', ReportSyncMetaSchema);

  return {
    ReportBooking,
    ReportTimetable,
    ReportSyncMeta,
  };
};

module.exports = {
  getReportModels,
  ReportBookingSchema,
  ReportTimetableSchema,
  ReportSyncMetaSchema,
};
