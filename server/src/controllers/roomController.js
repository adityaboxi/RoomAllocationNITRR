const mongoose = require('mongoose');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Holiday = require('../models/Holiday');
const { sendBookingCancellationEmail } = require('../utils/email');
const { getIO, emitToUser } = require('../utils/socket');
const { getDayOfWeek } = require('../utils/helpers');

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ---------- GET ROOMS (Branch Filter & Search Support) ----------
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
      sortBy,
    } = req.query;

    const query = { isActive: true };

    // Support filtering by specific department or 'ALL'
    if (department && department !== 'ALL') {
      query.department = department.trim();
    } else if (!department && req.user && req.user.role === 'HOD') {
      query.department = req.user.department;
    }

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
        { building: { $regex: sanitized, $options: 'i' } },
      ];
    }

    let sortQuery = { floor: 1, roomNumber: 1 };
    if (sortBy === 'floor') sortQuery = { floor: 1, roomNumber: 1 };
    else if (sortBy === 'capacity') sortQuery = { capacity: -1 };
    else if (sortBy === 'name') sortQuery = { name: 1 };

    const rooms = await Room.find(query).sort(sortQuery).lean();

    const formatted = rooms.map((r) => ({
      ...r,
      id: r._id.toString(),
    }));

    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    // console.error('Get rooms error:', error);
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
    // console.error('Get room error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET AVAILABLE ROOMS (WITH BRANCH FILTER & HOLIDAY GUARD) ----------
exports.getAvailableRooms = async (req, res) => {
  try {
    let {
      date,
      startTime,
      endTime,
      department,
      floor,
      building,
      roomType,
      hasProjector,
      hasAC,
      hasSmartBoard,
      hasWiFi,
    } = req.query;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'date, startTime and endTime are required' });
    }

    date = date.trim();
    startTime = startTime.trim();
    endTime = endTime.trim();

    if (startTime >= endTime) {
      return res.status(400).json({ success: false, message: 'startTime must be strictly before endTime' });
    }

    const day = getDayOfWeek(date);
    const baseQuery = { isAvailable: true, isActive: true };

    let targetDept = null;
    if (department && department !== 'ALL') {
      targetDept = department.trim();
    } else if (!department && req.user && req.user.role === 'HOD') {
      targetDept = req.user.department;
    }

    if (targetDept) {
      baseQuery.department = targetDept;
    }

    // 🔒 1. HOLIDAY CHECK: Check for National or Department-specific holiday
    const holidayQuery = { date };
    if (targetDept) {
      holidayQuery.$or = [{ department: targetDept }, { department: 'ALL' }];
    } else {
      holidayQuery.department = 'ALL';
    }

    const holiday = await Holiday.findOne(holidayQuery);
    const totalActiveRoomsCount = await Room.countDocuments(baseQuery);

    if (holiday) {
      return res.json({
        success: true,
        data: [],
        total: 0,
        unavailable: totalActiveRoomsCount,
        isHoliday: true,
        holidayTitle: holiday.title,
        message: `Department is closed on ${date} due to "${holiday.title}".`,
        filters: { department: targetDept, floor, building, roomType, hasProjector, hasAC, hasSmartBoard, hasWiFi },
      });
    }

    if (floor) baseQuery.floor = floor.trim();
    if (building) baseQuery.building = building.trim();
    if (roomType) baseQuery.type = roomType.trim();
    if (hasProjector === 'true') baseQuery.hasProjector = true;
    if (hasAC === 'true') baseQuery.hasAC = true;
    if (hasSmartBoard === 'true') baseQuery.hasSmartBoard = true;
    if (hasWiFi === 'true') baseQuery.hasWiFi = true;

    const [bookedRoomIds, timetableRoomIds] = await Promise.all([
      Booking.distinct('roomId', {
        date,
        status: 'active',
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      }),
      Timetable.distinct('roomId', {
        day,
        isActive: true,
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      }),
    ]);

    const unavailableIds = [
      ...new Set([
        ...bookedRoomIds.map((id) => id.toString()),
        ...timetableRoomIds.map((id) => id.toString()),
      ]),
    ];

    const availableRooms = await Room.find({
      ...baseQuery,
      _id: { $nin: unavailableIds },
    })
      .sort({ floor: 1, roomNumber: 1 })
      .lean();

    const formatted = availableRooms.map((r) => ({
      ...r,
      id: r._id.toString(),
    }));

    res.json({
      success: true,
      data: formatted,
      total: formatted.length,
      unavailable: totalActiveRoomsCount - formatted.length,
      isHoliday: false,
      filters: { department: targetDept, floor, building, roomType, hasProjector, hasAC, hasSmartBoard, hasWiFi },
    });
  } catch (error) {
    // console.error('Get available rooms error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- CREATE ROOM ----------
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

    name = name.trim();
    roomNumber = roomNumber.trim().toUpperCase();
    const department = req.user.department;

    // Check across entire institute
    const existing = await Room.findOne({
      isActive: true,
      $or: [
        { roomNumber: { $regex: new RegExp('^' + escapeRegex(roomNumber) + '$', 'i') } },
        { name: { $regex: new RegExp('^' + escapeRegex(name) + '$', 'i') }, department },
      ],
    }).populate('createdBy', 'name email');

    if (existing) {
      const addedByProf = existing.createdByName || existing.createdBy?.name || 'an HOD/Faculty';
      const existingDept = existing.department || 'another department';

      if (existing.roomNumber.toUpperCase() === roomNumber.toUpperCase()) {
        return res.status(400).json({
          success: false,
          message: `🚫 Cannot add room: Room Number "${existing.roomNumber}" is already registered by Prof. ${addedByProf} in the "${existingDept}" department (Room Name: "${existing.name}").`,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `🚫 Cannot add room: A room with the name "${existing.name}" is already registered by Prof. ${addedByProf} in your department (${existingDept}).`,
        });
      }
    }

    // Clean up any stale soft-deleted duplicate records
    await Room.deleteMany({
      isActive: false,
      $or: [
        { roomNumber: { $regex: new RegExp('^' + escapeRegex(roomNumber) + '$', 'i') } },
        { name: { $regex: new RegExp('^' + escapeRegex(name) + '$', 'i') }, department },
      ],
    });

    const room = await Room.create({
      ...req.body,
      name,
      roomNumber,
      capacity: numericCapacity,
      department,
      isActive: true,
      isAvailable: req.body.isAvailable !== undefined ? req.body.isAvailable : true,
      createdBy: req.user._id,
      createdByName: req.user.name,
    });

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', {
        department,
        reason: 'room-created',
      });
    }

    res.status(201).json({ success: true, message: 'Room created successfully', data: room });
  } catch (error) {
    // console.error('Create room error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- UPDATE ROOM ----------
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

    const isOwner = room.createdBy && room.createdBy.toString() === req.user._id.toString();
    const isHOD = req.user.role === 'HOD' && room.department === req.user.department;

    if (!isOwner && !isHOD) {
      return res.status(403).json({
        success: false,
        message: `Permission denied: Only the creator or the Department HOD can update this room.`,
      });
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

    if (req.body.name || req.body.roomNumber) {
      const duplicateQuery = {
        isActive: true,
        _id: { $ne: id },
        $or: [],
      };

      if (req.body.roomNumber) {
        duplicateQuery.$or.push({
          roomNumber: { $regex: new RegExp('^' + escapeRegex(req.body.roomNumber) + '$', 'i') },
        });
      }
      if (req.body.name) {
        duplicateQuery.$or.push({
          name: { $regex: new RegExp('^' + escapeRegex(req.body.name) + '$', 'i') },
          department: room.department,
        });
      }

      if (duplicateQuery.$or.length > 0) {
        const duplicate = await Room.findOne(duplicateQuery).populate('createdBy', 'name email');
        if (duplicate) {
          const addedByProf = duplicate.createdByName || duplicate.createdBy?.name || 'an HOD/Faculty';
          const existingDept = duplicate.department || 'another department';

          if (
            req.body.roomNumber &&
            duplicate.roomNumber.toUpperCase() === req.body.roomNumber.toUpperCase()
          ) {
            return res.status(400).json({
              success: false,
              message: `🚫 Cannot update room: Room Number "${duplicate.roomNumber}" is already in use by Prof. ${addedByProf} in the "${existingDept}" department (Room: "${duplicate.name}").`,
            });
          } else {
            return res.status(400).json({
              success: false,
              message: `🚫 Cannot update room: Room Name "${duplicate.name}" is already in use by Prof. ${addedByProf} in "${existingDept}".`,
            });
          }
        }
      }
    }

    delete req.body.department;
    delete req.body.createdBy;
    delete req.body.createdByName;

    const updatedRoom = await Room.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', {
        department: room.department,
        reason: 'room-updated',
      });
    }

    res.json({ success: true, message: 'Room updated successfully', data: updatedRoom });
  } catch (error) {
    // console.error('Update room error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- TOGGLE AVAILABILITY ----------
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

    const isOwner = room.createdBy && room.createdBy.toString() === req.user._id.toString();
    const isHOD = req.user.role === 'HOD' && room.department === req.user.department;

    if (!isOwner && !isHOD) {
      return res.status(403).json({
        success: false,
        message: `Permission denied: Only the creator or the Department HOD can toggle availability.`,
      });
    }

    room.isAvailable = !room.isAvailable;
    await room.save();

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', {
        department: room.department,
        reason: 'room-availability-toggled',
      });
    }

    res.json({
      success: true,
      message: `Room availability set to ${room.isAvailable ? 'Available' : 'Unavailable'}`,
      data: room,
    });
  } catch (error) {
    // console.error('Toggle room error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- DELETE ROOM ----------
exports.deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const isOwner = room.createdBy && room.createdBy.toString() === req.user._id.toString();
    const isHOD = req.user.role === 'HOD' && room.department === req.user.department;

    if (!isOwner && !isHOD) {
      return res.status(403).json({
        success: false,
        message: `Permission denied: Only the creator or Department HOD can delete this room.`,
      });
    }

    await Room.findByIdAndDelete(id);
    const timetableDeleteResult = await Timetable.deleteMany({ roomId: id });
    await Booking.deleteMany({ roomId: id, purpose: 'TEMPORARY_LOCK' });

    const todayStr = getTodayDateString();
    const affectedBookings = await Booking.find({
      roomId: id,
      date: { $gte: todayStr },
      status: 'active',
    });

    const cancellationReason = `Room "${room.name}" was removed from department inventory.`;

    for (const booking of affectedBookings) {
      booking.status = 'cancelled';
      booking.conflictMessage = cancellationReason;
      await booking.save();

      (async () => {
        try {
          await sendBookingCancellationEmail(booking, cancellationReason);
        } catch (emailErr) {}

        const facultyUser = await User.findOne({ email: booking.facultyEmail });
        if (facultyUser) {
          emitToUser(facultyUser._id.toString(), 'booking-cancelled', {
            bookingId: booking.id,
            roomName: room.name,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            reason: cancellationReason,
          });

          await Notification.create({
            userId: facultyUser._id,
            message: `Booking cancelled: Room "${room.name}" on ${booking.date} was deleted by department HOD.`,
            type: 'booking-cancelled',
            metadata: {
              roomId: room._id,
              roomName: room.name,
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              bookingId: booking.id,
            },
          });
        }
      })().catch(() => {});
    }

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', {
        department: room.department,
        roomId: room._id,
        reason: 'Room deleted',
      });
      io.emit('booking-cancelled', {
        roomId: room._id,
        roomName: room.name,
        reason: cancellationReason,
      });
    }

    res.json({
      success: true,
      message: `Room "${room.name}" deleted successfully. Removed ${timetableDeleteResult.deletedCount} timetable slots and cancelled ${affectedBookings.length} future bookings.`,
      data: {
        timetableSlotsDeleted: timetableDeleteResult.deletedCount,
        bookingsCancelled: affectedBookings.length,
      },
    });
  } catch (error) {
    // console.error('Delete room error:', error);
    res.status(400).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET REAL-TIME ROOM AVAILABILITY (WITH HOLIDAY CHECK) ----------
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

    const room = await Room.findById(roomId).lean();
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    // 🔒 Holiday Check
    const holiday = await Holiday.findOne({
      date: targetDate,
      $or: [{ department: room.department }, { department: 'ALL' }],
    });

    if (holiday) {
      return res.json({
        success: true,
        available: false,
        isHoliday: true,
        reason: 'Department Holiday',
        details: {
          title: holiday.title,
          description: holiday.description,
          until: 'End of Day',
        },
      });
    }

    const ttClash = await Timetable.findOne({
      roomId,
      day: day.trim(),
      startTime: { $lte: time },
      endTime: { $gt: time },
      isActive: true,
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
          until: ttClash.endTime,
        },
      });
    }

    const bookingClash = await Booking.findOne({
      roomId,
      date: targetDate,
      startTime: { $lte: time },
      endTime: { $gt: time },
      status: 'active',
    });

    if (bookingClash) {
      return res.json({
        success: true,
        available: false,
        reason: 'Booking',
        details: {
          purpose: bookingClash.purpose,
          facultyName: bookingClash.facultyName,
          until: bookingClash.endTime,
        },
      });
    }

    res.json({ success: true, available: true, message: 'Room is available' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};