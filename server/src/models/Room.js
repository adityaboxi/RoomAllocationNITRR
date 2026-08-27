const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    type: {
      type: String,
      enum: [
        'Classroom',
        'Lab',
        'Auditorium',
        'Lecture Hall',
        'Seminar Hall',
        'Conference Room',
      ],
      required: true,
      index: true,
    },
    floor: {
      type: String,
      required: true,
      trim: true,
    },
    building: {
      type: String,
      required: true,
      trim: true,
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
    isAvailable: {
      type: Boolean,
      default: true,
      index: true,
    },
    hasProjector: {
      type: Boolean,
      default: false,
    },
    hasAC: {
      type: Boolean,
      default: false,
    },
    hasSmartBoard: {
      type: Boolean,
      default: false,
    },
    hasWiFi: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// High-Performance Query Indexes for Filtering & Availability Lookups
RoomSchema.index({ department: 1, isActive: 1, isAvailable: 1 });
RoomSchema.index({ floor: 1, roomNumber: 1 });
RoomSchema.index({ building: 1, floor: 1 });

// Transform _id to id for JSON serialization
RoomSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// Transform _id to id for Object serialization
RoomSchema.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Room', RoomSchema);