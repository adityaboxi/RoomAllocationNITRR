const mongoose = require('mongoose');

const TimetableSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    classGroup: {
      type: String,
      required: true,
      trim: true,
    },
    faculty: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    semester: {
      type: String,
      enum: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'],
      required: true,
      index: true,
    },
    section: {
      type: String,
      enum: ['A', 'B', 'C', 'D'],
      required: true,
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// High-Performance Query Indexes
TimetableSchema.index({ department: 1, semester: 1, section: 1, isActive: 1 });
TimetableSchema.index({ roomId: 1, day: 1, isActive: 1, startTime: 1, endTime: 1 });
TimetableSchema.index({ faculty: 1, day: 1, isActive: 1, startTime: 1, endTime: 1 });

// Transform _id to id for JSON serialization
TimetableSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Transform _id to id for Object serialization
TimetableSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Timetable', TimetableSchema);