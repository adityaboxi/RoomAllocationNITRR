const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: [true, 'Room number is required'],
    unique: true,
    index: true,
    trim: true,
    uppercase: true,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9\-]+$/.test(v);
      },
      message: 'Room number can only contain letters, numbers, and hyphens'
    }
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Capacity must be at least 1'],
    max: [200, 'Capacity cannot exceed 200'],
    index: true
  },
  floor: {
    type: Number,
    required: [true, 'Floor number is required'],
    min: [0, 'Floor must be 0 or greater'],
    max: [20, 'Floor cannot exceed 20'],
    index: true
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA', 'General'],
    index: true
  },
  building: {
    type: String,
    required: [true, 'Building name is required'],
    index: true,
    trim: true,
    uppercase: true
  },
  hasProjector: {
    type: Boolean,
    default: false
  },
  hasAC: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Additional fields for better management
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  amenities: [{
    type: String,
    enum: ['projector', 'ac', 'whiteboard', 'smartboard', 'wifi', 'charging', 'audio']
  }],
  lastMaintenance: {
    type: Date
  },
  nextMaintenance: {
    type: Date
  }
}, {
  timestamps: true
});

// ============================================
// COMPOUND INDEXES
// ============================================

// Fast queries by department and building
RoomSchema.index({ department: 1, building: 1, floor: 1 });

// Fast queries for availability
RoomSchema.index({ isAvailable: 1, department: 1 });

// ============================================
// VIRTUAL PROPERTIES
// ============================================

RoomSchema.virtual('displayName').get(function() {
  return `${this.building} - ${this.roomNumber}`;
});

RoomSchema.virtual('isFullyEquipped').get(function() {
  return this.hasProjector && this.hasAC;
});

// ============================================
// INSTANCE METHODS
// ============================================

// Toggle availability
RoomSchema.methods.toggleAvailability = async function() {
  this.isAvailable = !this.isAvailable;
  await this.save();
  return this.isAvailable;
};

// Toggle active status
RoomSchema.methods.toggleActive = async function() {
  this.isActive = !this.isActive;
  await this.save();
  return this.isActive;
};

// Check if room can accommodate capacity
RoomSchema.methods.canAccommodate = function(requiredCapacity) {
  return this.capacity >= requiredCapacity && this.isAvailable && this.isActive;
};

// Mark for maintenance
RoomSchema.methods.markMaintenance = async function(date) {
  this.lastMaintenance = date || new Date();
  this.isAvailable = false;
  await this.save();
  return this;
};

// Complete maintenance
RoomSchema.methods.completeMaintenance = async function() {
  this.isAvailable = true;
  this.lastMaintenance = new Date();
  await this.save();
  return this;
};

// ============================================
// STATIC METHODS
// ============================================

// Get all rooms by department
RoomSchema.statics.getByDepartment = function(department) {
  return this.find({ 
    department, 
    isActive: true 
  }).sort({ roomNumber: 1 });
};

// Get available rooms by department
RoomSchema.statics.getAvailableByDepartment = function(department) {
  return this.find({ 
    department, 
    isAvailable: true,
    isActive: true 
  }).sort({ roomNumber: 1 });
};

// Get rooms by building
RoomSchema.statics.getByBuilding = function(building) {
  return this.find({ 
    building, 
    isActive: true 
  }).sort({ roomNumber: 1 });
};

// Get rooms by floor
RoomSchema.statics.getByFloor = function(floor, department = null) {
  const query = { floor, isActive: true };
  if (department) query.department = department;
  return this.find(query).sort({ roomNumber: 1 });
};

// Get rooms with amenities
RoomSchema.statics.getWithAmenities = function(amenities) {
  return this.find({
    amenities: { $all: amenities },
    isActive: true
  }).sort({ roomNumber: 1 });
};

// Bulk create rooms
RoomSchema.statics.bulkCreate = async function(rooms) {
  const validatedRooms = rooms.map(room => ({
    ...room,
    roomNumber: room.roomNumber.toUpperCase().trim()
  }));
  
  try {
    const result = await this.insertMany(validatedRooms, { ordered: false });
    return result;
  } catch (error) {
    if (error.code === 11000) {
      const duplicates = error.writeErrors?.map(e => e.err?.op?.roomNumber) || [];
      throw new Error(`Duplicate room numbers: ${duplicates.join(', ')}`);
    }
    throw error;
  }
};

// Get room statistics
RoomSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$department',
        total: { $sum: 1 },
        available: {
          $sum: { $cond: [{ $eq: ['$isAvailable', true] }, 1, 0] }
        },
        active: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        withProjector: {
          $sum: { $cond: [{ $eq: ['$hasProjector', true] }, 1, 0] }
        },
        withAC: {
          $sum: { $cond: [{ $eq: ['$hasAC', true] }, 1, 0] }
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

// Validate room number format
RoomSchema.pre('save', function(next) {
  this.roomNumber = this.roomNumber.toUpperCase().trim();
  next();
});

// Check for duplicate room number on update
RoomSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update.roomNumber) {
    update.roomNumber = update.roomNumber.toUpperCase().trim();
  }
  next();
});

// ============================================
// TO JSON TRANSFORM
// ============================================

RoomSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

RoomSchema.set('toObject', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Room', RoomSchema);
