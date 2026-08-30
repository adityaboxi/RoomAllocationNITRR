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
      default: true, // true = repeats every year (National); false = one-time only (Emergency)
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

// Automatic hook: Enforce recurring rule based on holiday type
HolidaySchema.pre('save', function (next) {
  if (this.date) {
    this.monthDay = this.date.slice(5);
  }
  if (this.type === 'EMERGENCY') {
    this.isRecurring = false; // Emergency holidays NEVER recur in future years
  } else if (this.type === 'NATIONAL') {
    this.isRecurring = true; // National holidays ALWAYS recur every year
  }
  next();
});

// Indexes
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