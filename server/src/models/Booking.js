const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  // References
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'Room is required'],
    index: true
  },
  professor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Professor is required'],
    index: true
  },

  // Date & Time
  date: {
    type: Date,
    required: [true, 'Date is required'],
    index: true
  },
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    required: [true, 'Day is required'],
    index: true
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Invalid time format (HH:MM)'
    }
  },
  endTime: {
    type: String,
    required: [true, 'End time is required'],
    validate: {
      validator: function(v) {
        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
      },
      message: 'Invalid time format (HH:MM)'
    }
  },

  // Booking Details
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  comment: {
    type: String,
    default: 'No comment provided',
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters']
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    index: true
  },

  // Status
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed', 'conflict'],
    default: 'active',
    index: true
  },
  conflictMessage: {
    type: String,
    default: ''
  },
  notified: {
    type: Boolean,
    default: false
  },

  // Lock System (Prevents Double Booking)
  lockId: {
    type: String,
    index: true,
    sparse: true
  },
  lockedAt: {
    type: Date,
    index: true
  }

}, {
  timestamps: true
});

// ============================================
// INDEXES
// ============================================

// Prevent double booking for same room at same time
BookingSchema.index(
  { room: 1, date: 1, startTime: 1, endTime: 1 },
  { unique: true }
);

// Fast queries for user bookings
BookingSchema.index({ professor: 1, date: 1, status: 1 });

// Fast queries for admin
BookingSchema.index({ status: 1, date: 1 });

// Auto-delete locks after 5 minutes
BookingSchema.index(
  { lockedAt: 1 },
  { expireAfterSeconds: 300 }
);

// Fast queries by department
BookingSchema.index({ department: 1, date: 1 });

// ============================================
// VIRTUAL PROPERTIES
// ============================================

BookingSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

BookingSchema.virtual('isCancelled').get(function() {
  return this.status === 'cancelled';
});

BookingSchema.virtual('isConflict').get(function() {
  return this.status === 'conflict';
});

// ============================================
// INSTANCE METHODS
// ============================================

// Cancel booking
BookingSchema.methods.cancel = function(reason = '') {
  this.status = 'cancelled';
  if (reason) {
    this.conflictMessage = reason;
  }
  return this.save();
};

// Mark as conflict
BookingSchema.methods.markConflict = function(message) {
  this.status = 'conflict';
  this.conflictMessage = message;
  return this.save();
};

// Complete booking
BookingSchema.methods.complete = function() {
  this.status = 'completed';
  return this.save();
};

// Check if booking is locked
BookingSchema.methods.isLocked = function() {
  return this.lockId && this.lockedAt && new Date() - this.lockedAt < 300000;
};

// ============================================
// STATIC METHODS
// ============================================

// Get active bookings for a room on a date
BookingSchema.statics.getActiveBookingsForRoom = function(roomId, date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return this.find({
    room: roomId,
    date: { $gte: start, $lte: end },
    status: 'active'
  }).sort({ startTime: 1 });
};

// Check if time slot is available
BookingSchema.statics.isSlotAvailable = async function(roomId, date, startTime, endTime) {
  const existing = await this.findOne({
    room: roomId,
    date: new Date(date),
    status: 'active',
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  });
  return !existing;
};

// ============================================
// MIDDLEWARE
// ============================================

// Validate startTime before endTime
BookingSchema.pre('save', function(next) {
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    next(new Error('Start time must be before end time'));
  }
  next();
});

// Set day from date if not provided
BookingSchema.pre('save', function(next) {
  if (!this.day && this.date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    this.day = days[this.date.getDay()];
  }
  next();
});

// ============================================
// TO JSON TRANSFORM
// ============================================

BookingSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

BookingSchema.set('toObject', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Booking', BookingSchema);
