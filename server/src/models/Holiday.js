const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      trim: true,
      index: true,
    },
    monthDay: {
      type: String, // Format: MM-DD (e.g. '08-15' for multi-year recurring matching)
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['NATIONAL', 'EMERGENCY'],
      default: 'NATIONAL',
      required: true,
      index: true,
    },
    isRecurring: {
      type: Boolean,
      default: true, // true = repeats every year; false = single day only
      index: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: 'Department / Institute Holiday',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    createdByName: {
      type: String,
      trim: true,
      default: 'Department HOD',
    },
  },
  {
    timestamps: true,
  }
);

// Atomic unique index: One holiday per date per department
HolidaySchema.index({ department: 1, date: 1 }, { unique: true });
HolidaySchema.index({ department: 1, isRecurring: 1, monthDay: 1 });

HolidaySchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

HolidaySchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Holiday', HolidaySchema);