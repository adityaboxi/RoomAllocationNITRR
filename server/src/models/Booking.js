const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    day: {
      type: String,
      enum: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      required: true,
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
    facultyName: {
      type: String,
      required: true,
      trim: true,
    },
    facultyEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    purpose: {
      type: String,
      required: true,
      trim: true,
    },
    comment: {
      type: String,
      default: 'No comment provided',
      trim: true,
    },
    department: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'cancelled', 'completed', 'conflict'],
      default: 'active',
      index: true,
    },
    conflictMessage: {
      type: String,
      default: '',
      trim: true,
    },
    lockId: {
      type: String,
      sparse: true,
      index: true,
    },
    lockedAt: {
      type: Date,
      default: undefined,
    },
    notified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Indexes for fast collision checks
BookingSchema.index(
  { roomId: 1, date: 1, startTime: 1, endTime: 1, status: 1 },
  { unique: false }
);
BookingSchema.index({ facultyEmail: 1, status: 1, date: -1 });
BookingSchema.index({ department: 1, status: 1, date: 1 });
BookingSchema.index({ roomId: 1, date: 1, status: 1, startTime: 1, endTime: 1 });

// SAFE PARTIAL TTL INDEX: Auto-deletes temporary checkout locks after 5 minutes
BookingSchema.index(
  { lockedAt: 1 },
  {
    expireAfterSeconds: parseInt(process.env.LOCK_EXPIRY_SECONDS, 10) || 300,
    partialFilterExpression: { purpose: 'TEMPORARY_LOCK' },
  }
);

// Transform _id to id for JSON output
BookingSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Transform _id to id for Object output
BookingSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Booking', BookingSchema);