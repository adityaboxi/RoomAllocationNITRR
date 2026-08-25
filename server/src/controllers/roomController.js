const Room = require('../models/Room');
const Timetable = require('../models/Timetable');
const Booking = require('../models/Booking');
const { getDayOfWeek } = require('../utils/helpers');

exports.createRooms = async (req, res) => {
  try {
    const { rooms } = req.body;
    
    if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of rooms'
      });
    }

    const validatedRooms = [];
    const errors = [];
    
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const { roomNumber, capacity, floor, department, building } = room;
      
      if (!roomNumber) errors.push(`Room ${i + 1}: Room number is required`);
      if (!capacity || capacity < 1) errors.push(`Room ${i + 1}: Capacity must be at least 1`);
      if (floor === undefined || floor === null || floor < 0) errors.push(`Room ${i + 1}: Floor must be 0 or greater`);
      if (!department) errors.push(`Room ${i + 1}: Department is required`);
      if (!building) errors.push(`Room ${i + 1}: Building is required`);

      if (errors.length === 0) {
        validatedRooms.push({
          roomNumber: roomNumber.toString().trim().toUpperCase(),
          capacity: parseInt(capacity),
          floor: parseInt(floor),
          department,
          building: building.trim(),
          hasProjector: room.hasProjector || false,
          hasAC: room.hasAC || false,
          isAvailable: true,
          isActive: true
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors found',
        errors
      });
    }

    const roomNumbers = validatedRooms.map(r => r.roomNumber);
    const existingRooms = await Room.find({ roomNumber: { $in: roomNumbers } });

    if (existingRooms.length > 0) {
      const duplicates = existingRooms.map(r => r.roomNumber);
      return res.status(400).json({
        success: false,
        message: 'Some room numbers already exist',
        duplicateRoomNumbers: duplicates
      });
    }

    const createdRooms = await Room.insertMany(validatedRooms);

    res.status(201).json({
      success: true,
      message: `${createdRooms.length} rooms created successfully`,
      data: createdRooms
    });
  } catch (error) {
    console.error('Create rooms error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllRooms = async (req, res) => {
  try {
    const { department, building, floor, isAvailable, limit = 100, page = 1 } = req.query;
    const query = { isActive: true };
    
    if (department) query.department = department;
    if (building) query.building = building;
    if (floor) query.floor = parseInt(floor);
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';

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

exports.getRoomsByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const rooms = await Room.find({ department, isActive: true }).lean();
    
    res.json({
      success: true,
      data: rooms,
      total: rooms.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
