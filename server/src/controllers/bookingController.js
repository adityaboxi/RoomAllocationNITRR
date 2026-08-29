const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Timetable = require('../models/Timetable');
const Holiday = require('../models/Holiday');
const { getDayOfWeek, generateLockId, getTodayDateString, getCurrentTimeHHMM } = require('../utils/helpers');
const { sendBookingConfirmationEmail, sendBookingCancellationEmail } = require('../utils/email');
const { getIO } = require('../utils/socket');

// Helper to validate HH:mm format
const isValidTimeFormat = (time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

// ---------- ATOMIC AUTO-COMPLETE HELPER ----------
const autoCompletePastBookings = async (extraQuery = {}) => {
  const todayStr = getTodayDateString();
  const currentHHMM = getCurrentTimeHHMM();

  try {
    await Booking.updateMany(
      {
        ...extraQuery,
        status: 'active',
        purpose: { $ne: 'TEMPORARY_LOCK' },
        $or: [
          { date: { $lt: todayStr } },
          { date: todayStr, endTime: { $lte: currentHHMM } },
        ],
      },
      { $set: { status: 'completed' } }
    );
  } catch (error) {
    // console.error('Auto-complete past bookings error:', error);
  }
};

// ---------- GET ALL / FILTERED BOOKINGS ----------
exports.getBookings = async (req, res) => {
  try {
    const { status, department, date, facultyEmail } = req.query;
    const query = {};

    if (department) query.department = department.trim();
    if (facultyEmail) query.facultyEmail = facultyEmail.trim().toLowerCase();

    if (req.user.role === 'HOD') {
      if (!department) query.department = req.user.department;
    } else {
      query.facultyEmail = req.user.email;
    }

    await autoCompletePastBookings(query);

    if (status) query.status = status;
    if (date) query.date = date.trim();

    const bookings = await Booking.find(query)
      .populate('roomId', 'name roomNumber floor building department capacity type')
      .sort({ date: -1, startTime: -1 })
      .lean();

    const formatted = bookings.map((b) => ({
      ...b,
      id: b._id.toString(),
    }));

    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    // console.error('Get bookings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET LOGGED-IN USER BOOKINGS ----------
exports.getMyBookings = async (req, res) => {
  try {
    await autoCompletePastBookings({ facultyEmail: req.user.email });

    const bookings = await Booking.find({
      facultyEmail: req.user.email,
      purpose: { $ne: 'TEMPORARY_LOCK' },
    })
      .populate('roomId', 'name roomNumber floor building department capacity type')
      .sort({ date: -1, startTime: -1 })
      .lean();

    const formatted = bookings.map((b) => ({
      ...b,
      id: b._id.toString(),
    }));

    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    // console.error('Get my bookings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET SINGLE BOOKING BY ID ----------
exports.getBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' });
    }

    await autoCompletePastBookings({ _id: id });

    const booking = await Booking.findById(id).populate(
      'roomId',
      'name roomNumber floor building department capacity type'
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    // console.error('Get booking by ID error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET BOOKINGS BY ROOM ----------
exports.getBookingsByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date } = req.query;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    await autoCompletePastBookings({ roomId });

    const query = { roomId, status: 'active' };
    if (date) query.date = date.trim();

    const bookings = await Booking.find(query)
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ date: 1, startTime: 1 })
      .lean();

    const formatted = bookings.map((b) => ({
      ...b,
      id: b._id.toString(),
    }));

    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    // console.error('Get bookings by room error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET BOOKINGS BY FACULTY ----------
exports.getBookingsByFaculty = async (req, res) => {
  try {
    const facultyEmail = req.params.facultyEmail.trim().toLowerCase();

    if (req.user.role !== 'HOD' && req.user.email !== facultyEmail) {
      return res.status(403).json({ success: false, message: 'Not authorized to view bookings of other faculty members' });
    }

    await autoCompletePastBookings({ facultyEmail });

    const bookings = await Booking.find({ facultyEmail })
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ date: -1, startTime: -1 })
      .lean();

    const formatted = bookings.map((b) => ({
      ...b,
      id: b._id.toString(),
    }));

    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    // console.error('Get bookings by faculty error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- CREATE BOOKING (WITH HOLIDAY GUARD) ----------
exports.createBooking = async (req, res) => {
  try {
    let { roomId, date, startTime, endTime, purpose, comment, lockId } = req.body;

    if (!roomId || !date || !startTime || !endTime || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'All fields (roomId, date, startTime, endTime, purpose) are required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    startTime = startTime.trim();
    endTime = endTime.trim();
    date = date.trim();
    purpose = purpose.trim();

    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      return res.status(400).json({ success: false, message: 'Invalid time format. Expected HH:mm (24-hour)' });
    }

    if (startTime >= endTime) {
      return res.status(400).json({ success: false, message: 'End time must be strictly after start time' });
    }

    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (durationMinutes < 15) {
      return res.status(400).json({ success: false, message: 'Booking slot must be at least 15 minutes in duration' });
    }

    const todayStr = getTodayDateString();
    const currentHHMM = getCurrentTimeHHMM();

    if (date < todayStr || (date === todayStr && startTime < currentHHMM)) {
      return res.status(400).json({ success: false, message: 'Cannot book past hours or dates' });
    }

    const maxDaysAdvance = parseInt(process.env.MAX_BOOKING_DAYS_ADVANCE, 10) || 7;
    const todayDate = new Date(todayStr);
    const maxBookingDate = new Date(todayDate);
    maxBookingDate.setDate(maxBookingDate.getDate() + maxDaysAdvance);
    const maxDateStr = maxBookingDate.toISOString().split('T')[0];

    if (date > maxDateStr) {
      return res.status(400).json({ success: false, message: `Cannot book more than ${maxDaysAdvance} days in advance` });
    }

    // 🔒 0. HOLIDAY CHECK
    const holiday = await Holiday.findOne({
      date,
      $or: [{ department: req.user.department }, { department: 'ALL' }],
    });

    if (holiday) {
      return res.status(400).json({
        success: false,
        message: `🚫 Cannot reserve room: ${date} is a declared holiday ("${holiday.title}").`,
        isHoliday: true,
      });
    }

    const day = getDayOfWeek(date);

    // 1. Room existence and availability check
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    if (!room.isActive || !room.isAvailable) {
      return res.status(400).json({ success: false, message: 'Room is currently deactivated or unavailable' });
    }

    // 2. User double-booking check
    const userConflictQuery = {
      facultyEmail: req.user.email,
      date,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: 'active',
    };
    if (lockId) userConflictQuery.lockId = { $ne: lockId };

    const userConflict = await Booking.findOne(userConflictQuery);
    if (userConflict) {
      return res.status(409).json({
        success: false,
        message: `You already have another active reservation (${userConflict.startTime} - ${userConflict.endTime}) during this time slot`,
      });
    }

    // 3. Room conflict check with other bookings
    const roomConflictQuery = {
      roomId,
      date,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: 'active',
    };
    if (lockId) roomConflictQuery.lockId = { $ne: lockId };

    const conflictingBooking = await Booking.findOne(roomConflictQuery);
    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        message: `Room is already reserved from ${conflictingBooking.startTime} to ${conflictingBooking.endTime}`,
        conflict: true,
      });
    }

    // 4. Room conflict check with master timetable
    const timetableConflict = await Timetable.findOne({
      roomId,
      day,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      isActive: true,
    });

    if (timetableConflict) {
      return res.status(409).json({
        success: false,
        message: `Room is scheduled for class ${timetableConflict.subject} (${timetableConflict.classGroup}) from ${timetableConflict.startTime} to ${timetableConflict.endTime}`,
        conflict: true,
        timetableConflict,
      });
    }

    let booking;

    // Convert lock if present
    if (lockId) {
      booking = await Booking.findOne({ lockId, facultyEmail: req.user.email });
      if (booking) {
        booking.roomId = roomId;
        booking.date = date;
        booking.day = day;
        booking.startTime = startTime;
        booking.endTime = endTime;
        booking.purpose = purpose;
        booking.comment = (comment || '').trim() || 'No comment provided';
        booking.facultyName = req.user.name;
        booking.facultyEmail = req.user.email;
        booking.department = req.user.department;
        booking.status = 'active';
        booking.lockId = undefined;
        booking.lockedAt = undefined;
        await booking.save();
      }
    }

    if (!booking) {
      booking = await Booking.create({
        roomId,
        date,
        day,
        startTime,
        endTime,
        purpose,
        comment: (comment || '').trim() || 'No comment provided',
        facultyName: req.user.name,
        facultyEmail: req.user.email,
        department: req.user.department,
        status: 'active',
        notified: false,
      });
    }

    const populated = await Booking.findById(booking._id).populate(
      'roomId',
      'name roomNumber floor building department'
    );

    sendBookingConfirmationEmail(populated)
      .then(() => Booking.findByIdAndUpdate(booking._id, { notified: true }))
      .catch((err) => {});

    const io = getIO();
    if (io) {
      io.emit('booking-created', {
        bookingId: populated.id,
        roomId: room._id,
        roomName: room.name,
        date: populated.date,
        startTime: populated.startTime,
        endTime: populated.endTime,
        purpose: populated.purpose,
        facultyName: populated.facultyName,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: populated,
    });
  } catch (error) {
    // console.error('Create booking error:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'This slot was just reserved by another user. Please choose another time.',
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- CANCEL BOOKING ----------
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' });
    }

    const booking = await Booking.findById(id).populate(
      'roomId',
      'name roomNumber building floor'
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }

    const todayStr = getTodayDateString();
    const currentHHMM = getCurrentTimeHHMM();

    if (booking.date < todayStr || (booking.date === todayStr && booking.endTime <= currentHHMM)) {
      booking.status = 'completed';
      await booking.save();
      return res.status(400).json({ success: false, message: 'Concluded bookings cannot be cancelled' });
    }

    booking.status = 'cancelled';
    booking.conflictMessage =
      req.user.role === 'HOD' ? 'Cancelled by Department HOD' : 'Cancelled by user';
    await booking.save();

    sendBookingCancellationEmail(booking, booking.conflictMessage)
      .then(() => Booking.findByIdAndUpdate(booking._id, { notified: true }))
      .catch((err) => {});

    const io = getIO();
    if (io) {
      io.emit('booking-cancelled', {
        bookingId: booking.id,
        roomId: booking.roomId?._id || booking.roomId,
        roomName: booking.roomId?.name || 'Room',
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        reason: booking.conflictMessage,
      });
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking,
    });
  } catch (error) {
    // console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- LOCK ROOM (WITH HOLIDAY GUARD) ----------
exports.lockRoom = async (req, res) => {
  try {
    let { roomId, date, startTime, endTime } = req.body;

    if (!roomId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'roomId, date, startTime, and endTime are required',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    startTime = startTime.trim();
    endTime = endTime.trim();
    date = date.trim();

    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      return res.status(400).json({ success: false, message: 'Invalid time format. Expected HH:mm' });
    }

    if (startTime >= endTime) {
      return res.status(400).json({ success: false, message: 'End time must be after start time' });
    }

    // 🔒 0. HOLIDAY CHECK
    const holiday = await Holiday.findOne({
      date,
      $or: [{ department: req.user.department }, { department: 'ALL' }],
    });

    if (holiday) {
      return res.status(400).json({
        success: false,
        message: `🚫 Cannot lock room: ${date} is a declared holiday ("${holiday.title}").`,
        isHoliday: true,
      });
    }

    const day = getDayOfWeek(date);
    const lockId = generateLockId();

    const existingConflict = await Booking.findOne({
      roomId,
      date,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: 'active',
    });

    if (existingConflict) {
      return res.status(409).json({
        success: false,
        message: 'Room is currently reserved or locked by another user',
      });
    }

    const ttConflict = await Timetable.findOne({
      roomId,
      day,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      isActive: true,
    });

    if (ttConflict) {
      return res.status(409).json({
        success: false,
        message: `Room is scheduled for class ${ttConflict.subject}`,
      });
    }

    const lock = await Booking.create({
      roomId,
      facultyName: req.user.name,
      facultyEmail: req.user.email,
      department: req.user.department,
      date,
      day,
      startTime,
      endTime,
      purpose: 'TEMPORARY_LOCK',
      comment: 'Room temporarily locked for checkout',
      status: 'active',
      lockId,
      lockedAt: new Date(),
    });

    const io = getIO();
    if (io) {
      io.emit('room-locked', {
        roomId: lock.roomId.toString(),
        lockId,
        date,
        startTime,
        endTime,
      });
    }

    res.json({
      success: true,
      message: 'Room locked successfully',
      lockId,
      expiresIn: `${parseInt(process.env.LOCK_EXPIRY_SECONDS, 10) || 300} seconds`,
      data: lock,
    });
  } catch (error) {
    // console.error('Lock room error:', error);
    res.status(500).json({ success: false, message: 'Failed to lock room', error: error.message });
  }
};

// ---------- UNLOCK ROOM ----------
exports.unlockRoom = async (req, res) => {
  try {
    const { lockId } = req.body;

    if (!lockId) {
      return res.status(400).json({ success: false, message: 'lockId is required' });
    }

    const booking = await Booking.findOne({ lockId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Lock not found or already expired' });
    }

    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'You do not have permission to unlock this room' });
    }

    const roomId = booking.roomId?.toString();
    await Booking.deleteOne({ _id: booking._id });

    const io = getIO();
    if (io) {
      io.emit('room-unlocked', {
        roomId,
        lockId,
      });
    }

    res.json({ success: true, message: 'Room unlocked successfully' });
  } catch (error) {
    // console.error('Unlock room error:', error);
    res.status(500).json({ success: false, message: 'Failed to unlock room', error: error.message });
  }
};