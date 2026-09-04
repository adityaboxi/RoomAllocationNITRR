const mongoose = require('mongoose');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Holiday = require('../models/Holiday');
const { sendBookingCancellationEmail, sendRoomDeletedNotificationEmail } = require('../utils/email');
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

    if (department && department !== 'ALL') {
      query.department = department.trim();
    }
    // Note: No auto-restriction for HOD — they can browse ALL rooms (incl. Common/Institute Level)
    // HOD restriction is only applied in timetable management, NOT room browsing/booking

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
    console.error("❌ [ROOM]", 'Get rooms error:', error);
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
    console.error("❌ [ROOM]", 'Get room error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET AVAILABLE ROOMS (WITH AUTO-ADJUSTING TIME GUARD) ----------
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

    if (!date) {
      date = getTodayDateString();
    }
    date = date.trim();

    // ⚡ Auto-calculate or correct startTime and endTime if missing or invalid
    if (!startTime || typeof startTime !== 'string') {
      const now = new Date();
      startTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    } else {
      startTime = startTime.trim();
    }

    if (!endTime || typeof endTime !== 'string' || startTime >= endTime) {
      const [h, m] = startTime.split(':').map(Number);
      if (h >= 23) {
        startTime = '23:00';
        endTime = '23:59';
      } else {
        endTime = `${String(h + 1).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
      }
    } else {
      endTime = endTime.trim();
    }

    const day = getDayOfWeek(date);
    const baseQuery = { isAvailable: true, isActive: true };

    let targetDept = null;
    if (department && department !== 'ALL') {
      targetDept = department.trim();
    }
    // No auto-restriction for HOD: when no dept filter is sent, show ALL free rooms college-wide
    // This allows HOD/Faculty to find and book any available room (incl. Common/Institute Level)

    if (targetDept) {
      baseQuery.department = targetDept;
    }

    // 🔒 1. HOLIDAY CHECK
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
        occupancyMap: {},
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

    // 🧹 Auto-clean expired temporary locks so they never show as falsely occupied
    const lockExpirySecs = parseInt(process.env.LOCK_EXPIRY_SECONDS, 10) || 300;
    const lockCutoff = new Date(Date.now() - lockExpirySecs * 1000);
    await Booking.deleteMany({
      purpose: 'TEMPORARY_LOCK',
      lockedAt: { $lt: lockCutoff },
    });

    // Fetch active bookings and timetables colliding in this window
    const [activeBookings, activeTimetables] = await Promise.all([
      Booking.find({
        date,
        status: 'active',
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      }).lean(),
      Timetable.find({
        day,
        isActive: true,
        startTime: { $lt: endTime },
        endTime: { $gt: startTime },
      }).lean(),
    ]);

    const occupancyMap = {};
    for (const b of activeBookings) {
      occupancyMap[b.roomId.toString()] = {
        type: 'BOOKING',
        facultyEmail: b.facultyEmail,
        facultyName: b.facultyName,
        purpose: b.purpose,
        startTime: b.startTime,
        endTime: b.endTime,
      };
    }
    for (const tt of activeTimetables) {
      if (!occupancyMap[tt.roomId.toString()]) {
        occupancyMap[tt.roomId.toString()] = {
          type: 'TIMETABLE',
          facultyName: tt.faculty,
          facultyEmail: tt.facultyEmail || '',
          purpose: `${tt.subject} (${tt.classGroup})`,
          startTime: tt.startTime,
          endTime: tt.endTime,
        };
      }
    }

    const unavailableIds = Object.keys(occupancyMap);

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
      occupancyMap,
      total: formatted.length,
      unavailable: totalActiveRoomsCount - formatted.length,
      isHoliday: false,
      filters: { department: targetDept, floor, building, roomType, hasProjector, hasAC, hasSmartBoard, hasWiFi },
    });
  } catch (error) {
    console.error("❌ [ROOM]", 'Get available rooms error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- CREATE ROOM (ADMIN ONLY) ----------
exports.createRoom = async (req, res) => {
  try {
    let { name, roomNumber, capacity, type, floor, building, department } = req.body;

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Permission denied: Only Admin can add rooms.' });
    }

    if (!name || !roomNumber || !capacity || !type || !floor || !building || !department) {
      return res.status(400).json({ success: false, message: 'All required room fields (including branch allocation) must be provided.' });
    }

    const numericCapacity = Number(capacity);
    if (isNaN(numericCapacity) || numericCapacity <= 0) {
      return res.status(400).json({ success: false, message: 'Capacity must be a positive integer' });
    }

    name = name.trim();
    roomNumber = roomNumber.trim().toUpperCase();
    department = department.trim();

    const existing = await Room.findOne({
      isActive: true,
      $or: [
        { roomNumber: { $regex: new RegExp('^' + escapeRegex(roomNumber) + '$', 'i') } },
        { name: { $regex: new RegExp('^' + escapeRegex(name) + '$', 'i') }, department },
      ],
    }).populate('createdBy', 'name email');

    if (existing) {
      if (existing.roomNumber.toUpperCase() === roomNumber.toUpperCase()) {
        return res.status(400).json({
          success: false,
          message: `🚫 Cannot add room: Room Number "${existing.roomNumber}" is already registered in the "${existing.department || 'another'}" department.`,
        });
      } else {
        return res.status(400).json({
          success: false,
          message: `🚫 Cannot add room: A room with the name "${existing.name}" is already registered in the ${existing.department || 'another'} department.`,
        });
      }
    }

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
      io.emit('timetable-updated', { department, reason: 'room-created' });
      io.emit('room-created', { room });
    }

    res.status(201).json({ success: true, message: 'Room created and allocated successfully', data: room });
  } catch (error) {
    console.error("❌ [ROOM]", 'Create room error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- UPDATE ROOM (ADMIN ONLY) ----------
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

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: `Permission denied: Only the Admin can update and allocate rooms.`,
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
    if (req.body.department) {
      req.body.department = req.body.department.trim();
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
          department: req.body.department || room.department,
        });
      }

      if (duplicateQuery.$or.length > 0) {
        const duplicate = await Room.findOne(duplicateQuery).populate('createdBy', 'name email');
        if (duplicate) {
          if (
            req.body.roomNumber &&
            duplicate.roomNumber.toUpperCase() === req.body.roomNumber.toUpperCase()
          ) {
            return res.status(400).json({
              success: false,
              message: `🚫 Cannot update room: Room Number "${duplicate.roomNumber}" is already in use in the "${duplicate.department}" department.`,
            });
          } else {
            return res.status(400).json({
              success: false,
              message: `🚫 Cannot update room: Room Name "${duplicate.name}" is already in use in "${duplicate.department}".`,
            });
          }
        }
      }
    }

    const oldDepartment = room.department;
    const newDepartment = req.body.department || oldDepartment;
    const isReallocating = oldDepartment !== newDepartment;

    delete req.body.createdBy;
    delete req.body.createdByName;

    const updatedRoom = await Room.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

    // 🚨 EDGE CASE: If Admin re-allocates a room to a DIFFERENT branch, clean up old timetables and bookings
    if (isReallocating) {
      await Timetable.deleteMany({ roomId: id });
      await Booking.deleteMany({ roomId: id, purpose: 'TEMPORARY_LOCK' });

      const todayStr = getTodayDateString();
      const affectedBookings = await Booking.find({
        roomId: id,
        date: { $gte: todayStr },
        status: 'active',
      });

      const cancellationReason = `Room "${room.name}" was re-allocated to the ${newDepartment} department by Admin.`;

      for (const booking of affectedBookings) {
        booking.status = 'cancelled';
        booking.conflictMessage = cancellationReason;
        await booking.save();

        (async () => {
          try {
            await sendBookingCancellationEmail(booking, cancellationReason);
          } catch (emailErr) {
            console.error('❌ [ROOM] Failed to send re-allocation cancellation email:', emailErr.message || emailErr);
          }

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
              message: `Booking cancelled: Room "${room.name}" on ${booking.date} was re-allocated to another department.`,
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
        })().catch((err) => {
          console.error('❌ [ROOM] Async re-allocation notification error:', err.message || err);
        });
      }

      const io = getIO();
      if (io) {
        io.emit('timetable-updated', { department: oldDepartment, reason: 'room-reallocated-away' });
        io.emit('booking-cancelled', { roomId: room._id, roomName: room.name, reason: cancellationReason });
      }
    }

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', { department: updatedRoom.department, reason: 'room-updated' });
      io.emit('room-updated', { room: updatedRoom });
    }

    res.json({ success: true, message: 'Room updated successfully', data: updatedRoom });
  } catch (error) {
    console.error("❌ [ROOM]", 'Update room error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- TOGGLE AVAILABILITY (ADMIN ONLY) ----------
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

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: `Permission denied: Only Admin can toggle room availability.`,
      });
    }

    room.isAvailable = !room.isAvailable;
    await room.save();

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', { department: room.department, reason: 'room-availability-toggled' });
      io.emit('room-updated', { room });
    }

    res.json({
      success: true,
      message: `Room availability set to ${room.isAvailable ? 'Available' : 'Unavailable'}`,
      data: room,
    });
  } catch (error) {
    console.error("❌ [ROOM]", 'Toggle room error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- DELETE ROOM (ADMIN ONLY) ----------
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

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: `Permission denied: Only Admin can delete rooms.`,
      });
    }

    // 🔐 Require admin to re-confirm identity with their password before destructive action
    const { adminPassword } = req.body;
    if (!adminPassword) {
      return res.status(400).json({ success: false, message: 'Admin password confirmation is required to delete a room.' });
    }

    // Verify against AdminUser DB password (supports post-reset passwords)
    const AdminUser = require('../models/AdminUser');
    const adminUser = await AdminUser.findOne({ email: req.user.email }).select('+password');
    if (!adminUser) {
      return res.status(403).json({ success: false, message: 'Admin account not found. Please log in again.' });
    }
    const isPasswordCorrect = await adminUser.comparePassword(adminPassword);
    if (!isPasswordCorrect) {
      return res.status(401).json({ success: false, message: '❌ Incorrect admin password. Deletion aborted.' });
    }

    // Capture room details BEFORE deletion for use in notifications
    const roomSnapshot = {
      _id: room._id,
      name: room.name,
      roomNumber: room.roomNumber,
      building: room.building,
      floor: room.floor,
      department: room.department,
    };

    // Delete room and timetable entries
    await Room.findByIdAndDelete(id);
    const timetableDeleteResult = await Timetable.deleteMany({ roomId: id });
    await Booking.deleteMany({ roomId: id, purpose: 'TEMPORARY_LOCK' });

    const todayStr = getTodayDateString();

    // Fetch all active future bookings (populate roomId so email has full room details)
    const affectedBookings = await Booking.find({
      roomId: id,
      date: { $gte: todayStr },
      status: 'active',
    });

    const cancellationReason = `Room "${roomSnapshot.name}" (${roomSnapshot.roomNumber}) in ${roomSnapshot.building} has been permanently removed from the ${roomSnapshot.department} department inventory by the System Administrator.`;

    // Cancel all affected bookings and notify each faculty member
    for (const booking of affectedBookings) {
      booking.status = 'cancelled';
      booking.conflictMessage = cancellationReason;
      await booking.save();
    }

    // Fire all notifications async (non-blocking — response is not delayed)
    (async () => {
      try {
        // 1. Notify each faculty member who had a booking
        for (const booking of affectedBookings) {
          try {
            // Inject room snapshot so email has full room info (room is already deleted from DB)
            const bookingWithRoom = {
              ...booking.toObject(),
              roomId: roomSnapshot,
            };
            await sendBookingCancellationEmail(bookingWithRoom, cancellationReason);
          } catch (emailErr) {
            console.error('❌ [ROOM] Failed to send delete room cancellation email:', emailErr.message || emailErr);
          }

          const facultyUser = await User.findOne({ email: booking.facultyEmail });
          if (facultyUser) {
            emitToUser(facultyUser._id.toString(), 'booking-cancelled', {
              bookingId: booking.id,
              roomName: roomSnapshot.name,
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              reason: cancellationReason,
            });

            await Notification.create({
              userId: facultyUser._id,
              message: `❌ Your booking for "${roomSnapshot.name}" on ${booking.date} (${booking.startTime}–${booking.endTime}) was cancelled — room has been removed by Admin.`,
              type: 'booking-cancelled',
              metadata: {
                roomId: roomSnapshot._id,
                roomName: roomSnapshot.name,
                date: booking.date,
                startTime: booking.startTime,
                endTime: booking.endTime,
                bookingId: booking.id,
              },
            });
          }
        }

        // 2. Notify the HOD of that department
        const hod = await User.findOne({
          role: 'HOD',
          department: roomSnapshot.department,
          isActive: true,
        });

        if (hod) {
          // In-app notification for HOD
          await Notification.create({
            userId: hod._id,
            message: `🏫 Admin removed room "${roomSnapshot.name}" (${roomSnapshot.roomNumber}) from your department. ${timetableDeleteResult.deletedCount} timetable slot(s) and ${affectedBookings.length} booking(s) were cancelled.`,
            type: 'system',
            metadata: {
              roomId: roomSnapshot._id,
              roomName: roomSnapshot.name,
              roomNumber: roomSnapshot.roomNumber,
              department: roomSnapshot.department,
              bookingsCancelled: affectedBookings.length,
              timetableSlotsRemoved: timetableDeleteResult.deletedCount,
            },
          });

          // Real-time socket push to HOD
          emitToUser(hod._id.toString(), 'room-deleted', {
            roomId: roomSnapshot._id,
            roomName: roomSnapshot.name,
            department: roomSnapshot.department,
            message: `Room "${roomSnapshot.name}" was removed from your department by Admin.`,
          });

          // Email notification to HOD
          await sendRoomDeletedNotificationEmail({
            hodEmail: hod.email,
            hodName: hod.name,
            roomName: roomSnapshot.name,
            roomNumber: roomSnapshot.roomNumber,
            building: roomSnapshot.building,
            floor: roomSnapshot.floor,
            department: roomSnapshot.department,
            bookingsCancelled: affectedBookings.length,
            timetableSlotsRemoved: timetableDeleteResult.deletedCount,
          });
        }
      } catch (notifyErr) {
        console.error("❌ [ROOM] [deleteRoom] Notification error:", notifyErr.message || notifyErr);
      }
    })().catch((err) => {
      console.error('❌ [ROOM] Async deleteRoom cleanup error:', err.message || err);
    });

    // 3. Broadcast to all connected clients (live room list refresh)
    const io = getIO();
    if (io) {
      io.emit('room-deleted', { roomId: roomSnapshot._id, roomName: roomSnapshot.name, department: roomSnapshot.department });
      io.emit('timetable-updated', { department: roomSnapshot.department, roomId: roomSnapshot._id, reason: 'Room deleted' });
      if (affectedBookings.length > 0) {
        io.emit('booking-cancelled', { roomId: roomSnapshot._id, roomName: roomSnapshot.name, reason: cancellationReason });
      }
    }

    res.json({
      success: true,
      message: `Room "${roomSnapshot.name}" deleted successfully. Removed ${timetableDeleteResult.deletedCount} timetable slots and cancelled ${affectedBookings.length} future bookings.`,
      data: {
        timetableSlotsDeleted: timetableDeleteResult.deletedCount,
        bookingsCancelled: affectedBookings.length,
      },
    });
  } catch (error) {
    console.error("❌ [ROOM]", 'Delete room error:', error);
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