const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true, index: true, trim: true, uppercase: true },
  capacity: { type: Number, required: true, min: 1, index: true },
  floor: { type: Number, required: true, min: 0, index: true },
  department: { type: String, required: true, enum: ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA', 'General'], index: true },
  building: { type: String, required: true, index: true, trim: true },
  hasProjector: { type: Boolean, default: false },
  hasAC: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true, index: true },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

RoomSchema.index({ department: 1, building: 1, floor: 1 });

module.exports = mongoose.model('Room', RoomSchema);
