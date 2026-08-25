const mongoose = require('mongoose');

const TimetableSchema = new mongoose.Schema({
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA'],
    index: true
  },
  semester: {
    type: String,
    required: [true, 'Semester is required'],
    enum: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'],
    index: true
  },
  section: {
    type: String,
    enum: ['A', 'B', 'C', 'D'],
    required: [true, 'Section is required'],
    index: true
  },
  day: {
    type: String,
    required: [true, 'Day is required'],
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
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
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [100, 'Subject cannot exceed 100 characters']
  },
  professor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Professor is required'],
    index: true
  },
  room: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: [true, 'Room is required'],
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  version: {
    type: Number,
    default: 1,
    min: [1, 'Version must be at least 1']
  },
  // Additional fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// ============================================
// COMPOUND INDEXES
// ============================================

// Fast queries for department timetable
TimetableSchema.index({ department: 1, semester: 1, section: 1, day: 1 });

// Prevent overlapping classes in same room
TimetableSchema.index({ room: 1, day: 1, startTime: 1, endTime: 1 });

// Fast queries for professor timetable
TimetableSchema.index({ professor: 1, day: 1 });

// Fast queries for room timetable
TimetableSchema.index({ room: 1, day: 1 });

// Fast queries for active entries
TimetableSchema.index({ isActive: 1, department: 1 });

// ============================================
// VIRTUAL PROPERTIES
// ============================================

TimetableSchema.virtual('timeSlot').get(function() {
  return `${this.startTime} - ${this.endTime}`;
});

TimetableSchema.virtual('fullDay').get(function() {
  return `${this.day} (${this.timeSlot})`;
});

// ============================================
// INSTANCE METHODS
// ============================================

// Deactivate this timetable entry
TimetableSchema.methods.deactivate = async function() {
  this.isActive = false;
  await this.save();
  return this;
};

// Activate this timetable entry
TimetableSchema.methods.activate = async function() {
  this.isActive = true;
  await this.save();
  return this;
};

// Increment version
TimetableSchema.methods.incrementVersion = async function() {
  this.version += 1;
  await this.save();
  return this.version;
};

// Check if time overlaps with another entry
TimetableSchema.methods.overlapsWith = function(otherEntry) {
  if (this.room.toString() !== otherEntry.room.toString()) return false;
  if (this.day !== otherEntry.day) return false;
  return this.startTime < otherEntry.endTime && otherEntry.startTime < this.endTime;
};

// ============================================
// STATIC METHODS
// ============================================

// Get timetable for a department
TimetableSchema.statics.getByDepartment = function(department, semester = null, section = null) {
  const query = { department, isActive: true };
  if (semester) query.semester = semester;
  if (section) query.section = section;
  
  return this.find(query)
    .populate('professor', 'name email')
    .populate('room', 'roomNumber capacity building')
    .sort({ day: 1, startTime: 1 });
};

// Get timetable for a professor
TimetableSchema.statics.getByProfessor = function(professorId, day = null) {
  const query = { professor: professorId, isActive: true };
  if (day) query.day = day;
  
  return this.find(query)
    .populate('room', 'roomNumber capacity building')
    .sort({ day: 1, startTime: 1 });
};

// Get timetable for a room
TimetableSchema.statics.getByRoom = function(roomId, day = null) {
  const query = { room: roomId, isActive: true };
  if (day) query.day = day;
  
  return this.find(query)
    .populate('professor', 'name email')
    .sort({ day: 1, startTime: 1 });
};

// Check if room is free at a time slot
TimetableSchema.statics.isRoomFree = async function(roomId, day, startTime, endTime) {
  const existing = await this.findOne({
    room: roomId,
    day,
    isActive: true,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  });
  return !existing;
};

// Get overlapping entries
TimetableSchema.statics.getOverlapping = async function(roomId, day, startTime, endTime, excludeId = null) {
  const query = {
    room: roomId,
    day,
    isActive: true,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime }
  };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return this.find(query)
    .populate('professor', 'name email')
    .populate('room', 'roomNumber');
};

// Bulk create timetable entries
TimetableSchema.statics.bulkCreate = async function(entries, createdBy = null) {
  const entriesWithMeta = entries.map(entry => ({
    ...entry,
    createdBy,
    version: 1,
    isActive: true
  }));
  
  return this.insertMany(entriesWithMeta);
};

// Clone timetable to new semester/section
TimetableSchema.statics.cloneTimetable = async function(sourceDept, sourceSemester, sourceSection, targetDept, targetSemester, targetSection) {
  // Get source entries
  const sourceEntries = await this.find({
    department: sourceDept,
    semester: sourceSemester,
    section: sourceSection,
    isActive: true
  }).lean();

  // Create new entries
  const newEntries = sourceEntries.map(entry => ({
    ...entry,
    _id: undefined,
    department: targetDept,
    semester: targetSemester,
    section: targetSection,
    version: 1,
    isActive: true,
    createdAt: undefined,
    updatedAt: undefined
  }));

  return this.insertMany(newEntries);
};

// Get timetable statistics
TimetableSchema.statics.getStats = async function(department = null) {
  const match = { isActive: true };
  if (department) match.department = department;
  
  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          department: '$department',
          semester: '$semester',
          section: '$section',
          day: '$day'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.department',
        totalClasses: { $sum: '$count' },
        days: {
          $push: {
            day: '$_id.day',
            count: '$count'
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  return stats;
};

// ============================================
// MIDDLEWARE
// ============================================

// Validate startTime before endTime
TimetableSchema.pre('save', function(next) {
  if (this.startTime && this.endTime && this.startTime >= this.endTime) {
    next(new Error('Start time must be before end time'));
  }
  next();
});

// Check for overlaps before saving
TimetableSchema.pre('save', async function(next) {
  if (this.isActive) {
    const overlapping = await this.constructor.findOne({
      room: this.room,
      day: this.day,
      isActive: true,
      startTime: { $lt: this.endTime },
      endTime: { $gt: this.startTime },
      _id: { $ne: this._id }
    });
    
    if (overlapping) {
      next(new Error('This room is already scheduled at this time slot'));
    }
  }
  next();
});

// ============================================
// TO JSON TRANSFORM
// ============================================

TimetableSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

TimetableSchema.set('toObject', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Timetable', TimetableSchema);
