const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const { getDayOfWeek, generateLockId, isOverlapping } = require('../utils/helpers');
const { sendBookingConfirmationEmail, sendBookingCancellationEmail } = require('../utils/email');
const { getIO } = require('../utils/socket');

// Helper to validate HH:mm format
const isValidTimeFormat = (time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

// Helper to get normalized current time in IST/local environment
const getCurrentTimeHHMM = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

// Helper to get today's date string YYYY-MM-DD
const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ---------- GET BOOKINGS ----------
exports.getBookings = async (req, res) => {
  try {
    const { status, department, date, facultyEmail } = req.query;
    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (date) query.date = date;
    if (facultyEmail) query.facultyEmail = facultyEmail.trim().toLowerCase();

    if (req.user.role === 'HOD') {
      if (!department) query.department = req.user.department;
    } else {
      query.facultyEmail = req.user.email;
    }

    const bookings = await Booking.find(query)
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ date: -1, startTime: -1 });

    res.json({ success: true, data: bookings, total: bookings.length });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET MY BOOKINGS ----------
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ facultyEmail: req.user.email })
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ date: -1, startTime: -1 });

    res.json({ success: true, data: bookings, total: bookings.length });
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET BOOKING BY ID ----------
exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('roomId', 'name roomNumber floor building department');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET BOOKINGS BY ROOM ----------
exports.getBookingsByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const bookings = await Booking.find({ roomId, status: 'active' })
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ date: 1, startTime: 1 });

    res.json({ success: true, data: bookings, total: bookings.length });
  } catch (error) {
    console.error('Get bookings by room error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET BOOKINGS BY FACULTY ----------
exports.getBookingsByFaculty = async (req, res) => {
  try {
    const facultyEmail = req.params.facultyEmail.trim().toLowerCase();
    if (req.user.role !== 'HOD' && req.user.email !== facultyEmail) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these bookings' });
    }

    const bookings = await Booking.find({ facultyEmail })
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ date: -1, startTime: -1 });

    res.json({ success: true, data: bookings, total: bookings.length });
  } catch (error) {
    console.error('Get bookings by faculty error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- CREATE BOOKING (Race-Condition Protected & Lock-Aware) ----------
exports.createBooking = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let { roomId, date, startTime, endTime, purpose, comment, lockId } = req.body;

    if (!roomId || !date || !startTime || !endTime || !purpose) {
      return res.status(400).json({ success: false, message: 'Room, date, start time, end time, and purpose are required' });
    }

    startTime = startTime.trim();
    endTime = endTime.trim();
    date = date.trim();
    purpose = purpose.trim();

    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      return res.status(400).json({ success: false, message: 'Invalid time format. Expected HH:mm (24-hour format)' });
    }

    if (startTime >= endTime) {
      return res.status(400).json({ success: false, message: 'End time must be strictly after start time' });
    }

    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (durationMinutes < 30) {
      return res.status(400).json({ success: false, message: 'Booking must be at least 30 minutes in duration' });
    }

    // Date & Past-Time Validation
    const todayStr = getTodayDateString();
    if (date < todayStr) {
      return res.status(400).json({ success: false, message: 'Cannot book for a past date' });
    }

    if (date === todayStr) {
      const currentHHMM = getCurrentTimeHHMM();
      if (startTime < currentHHMM) {
        return res.status(400).json({ success: false, message: `Cannot book past time slots for today (Current time: ${currentHHMM})` });
      }
    }

    const todayDate = new Date(todayStr);
    const maxBookingDate = new Date(todayDate);
    maxBookingDate.setDate(maxBookingDate.getDate() + 7);
    const maxDateStr = maxBookingDate.toISOString().split('T')[0];

    if (date > maxDateStr) {
      return res.status(400).json({ success: false, message: 'Cannot book more than 7 days in advance' });
    }

    const day = getDayOfWeek(date);
    if (day === 'Sunday') {
      return res.status(400).json({ success: false, message: 'Bookings are not permitted on Sundays' });
    }

    // Execute atomic validation and insert in transaction
    session.startTransaction();

    const room = await Room.findById(roomId).session(session);
    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    if (!room.isActive || !room.isAvailable) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'Room is currently deactivated or unavailable' });
    }

    // Check if faculty already has another active booking at this time
    const userConflictQuery = {
      facultyEmail: req.user.email,
      date,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: 'active'
    };
    if (lockId) {
      userConflictQuery.lockId = { $ne: lockId };
    }

    const userExistingBooking = await Booking.findOne(userConflictQuery).session(session);
    if (userExistingBooking) {
      await session.abortTransaction();
      return res.status(409).json({ success: false, message: 'You already have another active booking during this time slot' });
    }

    // Check room conflicts with other bookings
    const roomConflictQuery = {
      roomId,
      date,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: 'active'
    };
    if (lockId) {
      roomConflictQuery.lockId = { $ne: lockId };
    }

    const conflictingBooking = await Booking.findOne(roomConflictQuery).session(session);
    if (conflictingBooking) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: `Room is already booked from ${conflictingBooking.startTime} to ${conflictingBooking.endTime}`,
        conflict: true
      });
    }

    // Check recurring timetable schedule conflicts
    const timetableConflict = await Timetable.findOne({
      roomId,
      day,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      isActive: true
    }).session(session);

    if (timetableConflict) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: `Room is scheduled for class ${timetableConflict.subject} (${timetableConflict.classGroup}) from ${timetableConflict.startTime} to ${timetableConflict.endTime}`,
        conflict: true,
        timetableConflict
      });
    }

    let booking;
    // If a lock existed for this user, convert it to a confirmed booking
    if (lockId) {
      booking = await Booking.findOne({ lockId, facultyEmail: req.user.email }).session(session);
      if (booking) {
        booking.roomId = roomId;
        booking.date = date;
        booking.day = day;
        booking.startTime = startTime;
        booking.endTime = endTime;
        booking.purpose = purpose;
        booking.comment = comment || 'No comment provided';
        booking.facultyName = req.user.name;
        booking.facultyEmail = req.user.email;
        booking.department = req.user.department;
        booking.status = 'active';
        booking.lockId = undefined;
        booking.lockedAt = undefined; // IMPORTANT: Removes TTL auto-deletion
        await booking.save({ session });
      }
    }

    if (!booking) {
      const created = await Booking.create([{
        roomId,
        date,
        day,
        startTime,
        endTime,
        purpose,
        comment: comment || 'No comment provided',
        facultyName: req.user.name,
        facultyEmail: req.user.email,
        department: req.user.department,
        status: 'active',
        notified: false
      }], { session });
      booking = created[0];
    }

    await session.commitTransaction();

    const populated = await Booking.findById(booking._id)
      .populate('roomId', 'name roomNumber floor building department');

    // Send confirmation email asynchronously
    sendBookingConfirmationEmail(populated)
      .then(() => Booking.findByIdAndUpdate(booking._id, { notified: true }))
      .catch((err) => console.error('Failed to send confirmation email:', err.message));

    // Emit Socket.IO event
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

    res.status(201).json({ success: true, message: 'Booking created successfully', data: populated });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('Create booking error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Room was just booked by another user for this slot. Please choose another time.' });
    }
    res.status(400).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
};

// ---------- CANCEL BOOKING ----------
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('roomId', 'name roomNumber building floor');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Completed bookings cannot be cancelled' });
    }

    const todayStr = getTodayDateString();
    if (booking.date < todayStr) {
      return res.status(400).json({ success: false, message: 'Cannot cancel past bookings' });
    }

    booking.status = 'cancelled';
    booking.conflictMessage = req.user.role === 'HOD' ? 'Cancelled by Department HOD' : 'Cancelled by user';
    await booking.save();

    // Send cancellation email asynchronously
    sendBookingCancellationEmail(booking, booking.conflictMessage)
      .then(() => Booking.findByIdAndUpdate(booking._id, { notified: true }))
      .catch((err) => console.error('Failed to send cancellation email:', err.message));

    // Emit Socket.IO event safely
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

    res.json({ success: true, message: 'Booking cancelled successfully', data: booking });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- LOCK ROOM (Safe Temporary Lock) ----------
exports.lockRoom = async (req, res) => {
  try {
    let { roomId, date, startTime, endTime } = req.body;
    if (!roomId || !date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'roomId, date, startTime, and endTime are required' });
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

    const day = getDayOfWeek(date);
    const lockId = generateLockId();

    // Check for any active booking or active lock on this slot
    const existingConflict = await Booking.findOne({
      roomId,
      date,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: 'active'
    });

    if (existingConflict) {
      return res.status(409).json({ success: false, message: 'Room is currently booked or being reserved by another user' });
    }

    // Check timetable conflict before locking
    const ttConflict = await Timetable.findOne({
      roomId,
      day,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      isActive: true
    });

    if (ttConflict) {
      return res.status(409).json({ success: false, message: `Room is scheduled for ${ttConflict.subject}` });
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
      lockedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Room locked successfully',
      lockId,
      expiresIn: '5 minutes',
      data: lock
    });
  } catch (error) {
    console.error('Lock room error:', error);
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

    await Booking.deleteOne({ _id: booking._id });
    res.json({ success: true, message: 'Room unlocked successfully' });
  } catch (error) {
    console.error('Unlock room error:', error);
    res.status(500).json({ success: false, message: 'Failed to unlock room', error: error.message });
  }
};