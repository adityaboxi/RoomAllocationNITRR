const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Timetable = require('../models/Timetable');
const { getDayOfWeek } = require('../utils/helpers');

exports.getRooms = async (req, res) => {
  try {
    const { department, floor, building, isAvailable, search, roomType, hasProjector, hasAC, hasSmartBoard, sortBy } = req.query;
    const query = { isActive: true };
    if (department) query.department = department;
    if (floor) query.floor = floor;
    if (building) query.building = building;
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';
    if (roomType) query.type = roomType;
    if (hasProjector === 'true') query.hasProjector = true;
    if (hasAC === 'true') query.hasAC = true;
    if (hasSmartBoard === 'true') query.hasSmartBoard = true;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { roomNumber: { $regex: search, $options: 'i' } },
        { building: { $regex: search, $options: 'i' } }
      ];
    }
    let sortQuery = {};
    if (sortBy === 'floor') sortQuery = { floor: 1, roomNumber: 1 };
    else if (sortBy === 'capacity') sortQuery = { capacity: -1 };
    else if (sortBy === 'name') sortQuery = { name: 1 };
    else sortQuery = { floor: 1, roomNumber: 1 };

    const rooms = await Room.find(query).sort(sortQuery);
    res.json({ success: true, data: rooms, total: rooms.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAvailableRooms = async (req, res) => {
  try {
    const { date, startTime, endTime, department, floor, building, roomType, hasProjector, hasAC } = req.query;
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'date, startTime and endTime are required' });
    }

    const day = getDayOfWeek(date);
    const query = { isAvailable: true, isActive: true };
    if (department) query.department = department;
    if (floor) query.floor = floor;
    if (building) query.building = building;
    if (roomType) query.type = roomType;
    if (hasProjector === 'true') query.hasProjector = true;
    if (hasAC === 'true') query.hasAC = true;

    const allRooms = await Room.find(query);
    const bookedRoomIds = await Booking.distinct('roomId', {
      date,
      status: 'active',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });
    const timetableRoomIds = await Timetable.distinct('roomId', {
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
      unavailable: allRooms.length - availableRooms.length,
      filters: { department, floor, building, roomType, hasProjector, hasAC }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomsByFloor = async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true }).sort({ floor: 1, roomNumber: 1 });
    const groupedByFloor = rooms.reduce((acc, room) => {
      if (!acc[room.floor]) acc[room.floor] = [];
      acc[room.floor].push(room);
      return acc;
    }, {});
    res.json({ success: true, data: groupedByFloor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomsByBuilding = async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true });
    const groupedByBuilding = rooms.reduce((acc, room) => {
      if (!acc[room.building]) acc[room.building] = [];
      acc[room.building].push(room);
      return acc;
    }, {});
    res.json({ success: true, data: groupedByBuilding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomsByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const rooms = await Room.find({ department, isActive: true }).sort({ floor: 1, roomNumber: 1 });
    res.json({ success: true, data: rooms, total: rooms.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createRoom = async (req, res) => {
  try {
    if (req.body.department && req.body.department !== req.user.department) {
      return res.status(403).json({ success: false, message: `You can only create rooms for your department (${req.user.department})` });
    }
    req.body.department = req.user.department;
    const room = await Room.create(req.body);
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Room already exists with this name or room number' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'You can only update rooms for your department' });
    }
    const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: updatedRoom });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Room already exists with this name or room number' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.toggleRoomAvailability = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'You can only toggle rooms for your department' });
    }
    room.isAvailable = !room.isAvailable;
    await room.save();
    res.json({ success: true, message: `Room availability set to ${room.isAvailable}`, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'You can only delete rooms for your department' });
    }
    await Room.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getRoomAvailability = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { day, time } = req.query;
    if (!day || !time) return res.status(400).json({ success: false, message: 'Day and time required' });

    const ttClash = await Timetable.findOne({
      roomId,
      day,
      startTime: { $lte: time },
      endTime: { $gt: time },
      isActive: true
    });
    if (ttClash) {
      return res.json({
        success: true,
        available: false,
        reason: 'Timetable class',
        details: {
          subject: ttClash.subject,
          classGroup: ttClash.classGroup,
          faculty: ttClash.faculty,
          until: ttClash.endTime
        }
      });
    }

    const bookingClash = await Booking.findOne({
      roomId,
      date: new Date().toISOString().split('T')[0],
      startTime: { $lte: time },
      endTime: { $gt: time },
      status: 'active'
    });
    if (bookingClash) {
      return res.json({
        success: true,
        available: false,
        reason: 'Booking',
        details: {
          purpose: bookingClash.purpose,
          facultyName: bookingClash.facultyName,
          until: bookingClash.endTime
        }
      });
    }

    res.json({ success: true, available: true, message: 'Room is available' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
