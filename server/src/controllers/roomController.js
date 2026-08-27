const mongoose = require('mongoose');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Timetable = require('../models/Timetable');
const { getDayOfWeek } = require('../utils/helpers');

// Helper to escape regex special characters (prevents ReDoS and regex crashes)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper to get normalized current date string YYYY-MM-DD
const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ---------- GET ROOMS (With Safe Search & Filters) ----------
exports.getRooms = async (req, res) => {
  try {
    const {
      department,
      floor,
      building,
      isAvailable,
      search,
      roomType,
      hasProjector,
      hasAC,
      hasSmartBoard,
      hasWiFi,
      sortBy
    } = req.query;

    const query = { isActive: true };

    if (department) query.department = department.trim();
    if (floor) query.floor = floor.trim();
    if (building) query.building = building.trim();
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';
    if (roomType) query.type = roomType.trim();
    if (hasProjector === 'true') query.hasProjector = true;
    if (hasAC === 'true') query.hasAC = true;
    if (hasSmartBoard === 'true') query.hasSmartBoard = true;
    if (hasWiFi === 'true') query.hasWiFi = true;

    if (search && search.trim()) {
      const sanitized = escapeRegex(search.trim());
      query.$or = [
        { name: { $regex: sanitized, $options: 'i' } },
        { roomNumber: { $regex: sanitized, $options: 'i' } },
        { building: { $regex: sanitized, $options: 'i' } }
      ];
    }

    let sortQuery = { floor: 1, roomNumber: 1 };
    if (sortBy === 'floor') sortQuery = { floor: 1, roomNumber: 1 };
    else if (sortBy === 'capacity') sortQuery = { capacity: -1 };
    else if (sortBy === 'name') sortQuery = { name: 1 };

    const rooms = await Room.find(query).sort(sortQuery).lean();

    // Map _id to id for frontend compatibility
    const formatted = rooms.map((r) => ({
      ...r,
      id: r._id.toString()
    }));

    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET ROOM BY ID ----------
exports.getRoom = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const room = await Room.findById(id);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    res.json({ success: true, data: room });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET AVAILABLE ROOMS (Database-Level Pushdown) ----------
exports.getAvailableRooms = async (req, res) => {
  try {
    let { date, startTime, endTime, department, floor, building, roomType, hasProjector, hasAC, hasSmartBoard, hasWiFi } = req.query;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'date, startTime and endTime are required' });
    }

    date = date.trim();
    startTime = startTime.trim();
    endTime = endTime.trim();

    const day = getDayOfWeek(date);
    const baseQuery = { isAvailable: true, isActive: true };

    if (department) baseQuery.department = department.trim();
    if (floor) baseQuery.floor = floor.trim();
    if (building) baseQuery.building = building.trim();
    if (roomType) baseQuery.type = roomType.trim();
    if (hasProjector === 'true') baseQuery.hasProjector = true;
    if (hasAC === 'true') baseQuery.hasAC = true;
    if (hasSmartBoard === 'true') baseQuery.hasSmartBoard = true;
    if (hasWiFi === 'true') baseQuery.hasWiFi = true;

    // Parallel fetch of booked room IDs and timetable room IDs
    const [bookedRoomIds, timetableRoomIds, totalActiveRoomsCount] = await Promise.all([
      Booking.distinct('roomId', {
        date,
        status: 'active',
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
      }),
      Timetable.distinct('roomId', {
        day,
        isActive: true,
        startTime: { $lt: endTime },
        endTime: { $gt: startTime }
      }),
      Room.countDocuments(baseQuery)
    ]);

    const unavailableIds = [...new Set([
      ...bookedRoomIds.map(id => id.toString()),
      ...timetableRoomIds.map(id => id.toString())
    ])];

    // Push down filtering directly to MongoDB using $nin
    const availableRooms = await Room.find({
      ...baseQuery,
      _id: { $nin: unavailableIds }
    }).sort({ floor: 1, roomNumber: 1 }).lean();

    const formatted = availableRooms.map((r) => ({
      ...r,
      id: r._id.toString()
    }));

    res.json({
      success: true,
      data: formatted,
      total: formatted.length,
      unavailable: totalActiveRoomsCount - formatted.length,
      filters: { department, floor, building, roomType, hasProjector, hasAC, hasSmartBoard, hasWiFi }
    });
  } catch (error) {
    console.error('Get available rooms error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET ROOMS BY FLOOR ----------
exports.getRoomsByFloor = async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true }).sort({ floor: 1, roomNumber: 1 }).lean();
    const groupedByFloor = rooms.reduce((acc, room) => {
      const key = room.floor || 'Unknown';
      if (!acc[key]) acc[key] = [];
      acc[key].push({ ...room, id: room._id.toString() });
      return acc;
    }, {});

    res.json({ success: true, data: groupedByFloor });
  } catch (error) {
    console.error('Get rooms by floor error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET ROOMS BY BUILDING ----------
exports.getRoomsByBuilding = async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true }).sort({ building: 1, floor: 1, roomNumber: 1 }).lean();
    const groupedByBuilding = rooms.reduce((acc, room) => {
      const key = room.building || 'Main Building';
      if (!acc[key]) acc[key] = [];
      acc[key].push({ ...room, id: room._id.toString() });
      return acc;
    }, {});

    res.json({ success: true, data: groupedByBuilding });
  } catch (error) {
    console.error('Get rooms by building error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET ROOMS BY DEPARTMENT ----------
exports.getRoomsByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const rooms = await Room.find({ department: department.trim(), isActive: true })
      .sort({ floor: 1, roomNumber: 1 })
      .lean();

    const formatted = rooms.map((r) => ({ ...r, id: r._id.toString() }));
    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    console.error('Get rooms by department error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- CREATE ROOM (HOD Only) ----------
exports.createRoom = async (req, res) => {
  try {
    let { name, roomNumber, capacity, type, floor, building } = req.body;

    if (!name || !roomNumber || !capacity || !type || !floor || !building) {
      return res.status(400).json({ success: false, message: 'All required room fields must be provided' });
    }

    const numericCapacity = Number(capacity);
    if (isNaN(numericCapacity) || numericCapacity <= 0) {
      return res.status(400).json({ success: false, message: 'Capacity must be a positive integer' });
    }

    const department = req.user.department;
    name = name.trim();
    roomNumber = roomNumber.trim().toUpperCase();

    const room = await Room.create({
      ...req.body,
      name,
      roomNumber,
      capacity: numericCapacity,
      department,
      isActive: true,
      isAvailable: req.body.isAvailable !== undefined ? req.body.isAvailable : true
    });

    res.status(201).json({ success: true, message: 'Room created successfully', data: room });
  } catch (error) {
    console.error('Create room error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A room already exists with this name or room number' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- UPDATE ROOM (HOD Only) ----------
exports.updateRoom = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const room = await Room.findById(id);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'You can only update rooms for your department' });
    }

    if (req.body.roomNumber) {
      req.body.roomNumber = req.body.roomNumber.trim().toUpperCase();
    }
    if (req.body.name) {
      req.body.name = req.body.name.trim();
    }
    if (req.body.capacity) {
      req.body.capacity = Number(req.body.capacity);
    }

    // Protect department from being arbitrarily modified
    delete req.body.department;

    const updatedRoom = await Room.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    res.json({ success: true, message: 'Room updated successfully', data: updatedRoom });
  } catch (error) {
    console.error('Update room error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A room already exists with this name or room number' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- TOGGLE ROOM AVAILABILITY (HOD Only) ----------
exports.toggleRoomAvailability = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const room = await Room.findById(id);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'You can only toggle rooms for your department' });
    }

    room.isAvailable = !room.isAvailable;
    await room.save();

    res.json({
      success: true,
      message: `Room availability set to ${room.isAvailable ? 'Available' : 'Unavailable'}`,
      data: room
    });
  } catch (error) {
    console.error('Toggle room availability error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- DELETE ROOM (HOD Only - Safe Soft Delete with Cascade) ----------
exports.deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const room = await Room.findById(id);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'You can only delete rooms for your department' });
    }

    // Soft delete room to preserve history and prevent dangling references
    room.isActive = false;
    room.isAvailable = false;
    await room.save();

    // Deactivate associated timetable entries
    await Timetable.updateMany({ roomId: id, isActive: true }, { $set: { isActive: false } });

    // Cancel future active bookings for this room
    const todayStr = getTodayDateString();
    await Booking.updateMany(
      { roomId: id, date: { $gte: todayStr }, status: 'active' },
      { $set: { status: 'cancelled', conflictMessage: 'Room has been decommissioned by Department HOD' } }
    );

    res.json({ success: true, message: 'Room deleted successfully and associated schedules updated' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- GET REAL-TIME ROOM AVAILABILITY ----------
exports.getRoomAvailability = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { day, time, date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    if (!day || !time) {
      return res.status(400).json({ success: false, message: 'Day and time are required' });
    }

    const targetDate = date ? date.trim() : getTodayDateString();

    const ttClash = await Timetable.findOne({
      roomId,
      day: day.trim(),
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
      date: targetDate,
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
    console.error('Get room availability error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};