const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 1 },
  type: { type: String, enum: ['Classroom', 'Lab', 'Auditorium', 'Lecture Hall'], required: true },
  floor: { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

RoomSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('Room', RoomSchema);
