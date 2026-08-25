const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: [true, 'Room number is required'],
    unique: true,
    index: true,
    trim: true,
    uppercase: true
  },
  capacity: {
    type: Number,
    required: [true, 'Capacity is required'],
    min: [1, 'Capacity must be at least 1'],
    index: true
  },
  floor: {
    type: Number,
    required: [true, 'Floor number is required'],
    min: [0, 'Floor must be 0 or greater'],
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
    trim: true
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
  }
}, { timestamps: true });

RoomSchema.index({ department: 1, building: 1, floor: 1 });

module.exports = mongoose.model('Room', RoomSchema);
