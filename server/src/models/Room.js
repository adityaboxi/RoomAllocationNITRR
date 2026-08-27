const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  roomNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  capacity: { type: Number, required: true, min: 1 },
  type: { type: String, enum: ['Classroom','Lab','Auditorium','Lecture Hall','Seminar Hall','Conference Room'], required: true },
  floor: { type: String, required: true },
  building: { type: String, required: true },
  department: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  hasProjector: { type: Boolean, default: false },
  hasAC: { type: Boolean, default: false },
  hasSmartBoard: { type: Boolean, default: false },
  hasWiFi: { type: Boolean, default: false },
}, { timestamps: true });

RoomSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Room', RoomSchema);