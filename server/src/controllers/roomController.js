const Room = require('../models/Room');
const Booking = require('../models/Booking');

exports.getAllRooms = async (req, res) => {
  try {
    const { department, building, floor, limit = 100, page = 1 } = req.query;
    const query = { isActive: true };
    
    if (department) query.department = department;
    if (building) query.building = building;
    if (floor) query.floor = parseInt(floor);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const rooms = await Room.find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Room.countDocuments(query);
    
    res.json({
      success: true,
      data: rooms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAvailableRooms = async (req, res) => {
  try {
    const { date, startTime, endTime, department } = req.query;
    
    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'date, startTime and endTime are required'
      });
    }

    const day = getDayOfWeek(date);
    const query = { isAvailable: true, isActive: true };
    if (department) query.department = department;

    const allRooms = await Room.find(query).lean();
    
    const bookedRoomIds = await Booking.distinct('room', {
      date: new Date(date),
      status: 'active',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });

    const timetableRoomIds = await Timetable.distinct('room', {
      day,
      isActive: true,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });

    const bookedIds = new Set([
      ...bookedRoomIds.map(id => id.toString()),
      ...timetableRoomIds.map(id => id.toString())
    ]);

    const availableRooms = allRooms.filter(room => !bookedIds.has(room._id.toString()));

    res.json({
      success: true,
      data: availableRooms,
      total: availableRooms.length,
      unavailable: allRooms.length - availableRooms.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.toggleRoomAvailability = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    
    room.isAvailable = !room.isAvailable;
    await room.save();
    
    res.json({
      success: true,
      message: `Room availability set to ${room.isAvailable}`,
      data: room
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
