const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Timetable = require('../models/Timetable');
const User = require('../models/User');
const { getDayOfWeek, generateLockId } = require('../utils/helpers');
const { sendBookingConfirmationEmail, sendBookingCancellationEmail } = require('../utils/email');
const { getIO } = require('../utils/socket'); // <-- added

// ---------- GET BOOKINGS (unchanged) ----------
exports.getBookings = async (req, res) => {
  try {
    const { status, department, date, facultyEmail } = req.query;
    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (date) query.date = date;
    if (facultyEmail) query.facultyEmail = facultyEmail;

    if (req.user.role === 'HOD') {
      if (!department) query.department = req.user.department;
    } else {
      query.facultyEmail = req.user.email;
    }

    const bookings = await Booking.find(query)
      .populate('roomId', 'name roomNumber floor building')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET MY BOOKINGS (unchanged) ----------
exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ facultyEmail: req.user.email })
      .populate('roomId', 'name roomNumber floor building')
      .sort({ date: -1, startTime: -1 });
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET BOOKING BY ID (unchanged) ----------
exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('roomId', 'name roomNumber floor building');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET BOOKINGS BY ROOM (unchanged) ----------
exports.getBookingsByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    const bookings = await Booking.find({ roomId })
      .populate('roomId', 'name roomNumber floor building')
      .sort({ date: -1, startTime: -1 });
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET BOOKINGS BY FACULTY (unchanged) ----------
exports.getBookingsByFaculty = async (req, res) => {
  try {
    const { facultyEmail } = req.params;
    if (req.user.role !== 'HOD' && req.user.email !== facultyEmail) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these bookings' });
    }
    const bookings = await Booking.find({ facultyEmail })
      .populate('roomId', 'name roomNumber floor building')
      .sort({ date: -1, startTime: -1 });
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- CREATE BOOKING (with socket emission) ----------
exports.createBooking = async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, purpose, comment } = req.body;
    if (!roomId || !date || !startTime || !endTime || !purpose) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (startTime >= endTime) {
      return res.status(400).json({ success: false, message: 'End time must be after start time' });
    }
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (durationMinutes < 30) {
      return res.status(400).json({ success: false, message: 'Booking must be at least 30 minutes' });
    }

    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({ success: false, message: 'Cannot book in the past' });
    }
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);
    if (bookingDate > maxDate) {
      return res.status(400).json({ success: false, message: 'Cannot book more than 7 days in advance' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (!room.isAvailable) {
      return res.status(400).json({ success: false, message: 'Room is currently unavailable' });
    }

    const day = getDayOfWeek(date);

    // Check user existing booking
    const userExistingBooking = await Booking.findOne({
      facultyEmail: req.user.email,
      date,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: 'active'
    });
    if (userExistingBooking) {
      return res.status(409).json({ success: false, message: 'You already have a booking at this time' });
    }

    // Check other bookings for same room
    const conflictingBooking = await Booking.findOne({
      roomId,
      date,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: 'active'
    });
    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        message: 'Room is already booked for this time slot',
        conflict: true
      });
    }

    // Check timetable conflicts
    const timetableConflict = await Timetable.findOne({
      roomId,
      day,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      isActive: true
    });
    if (timetableConflict) {
      return res.status(409).json({
        success: false,
        message: `Room is scheduled for ${timetableConflict.subject} from ${timetableConflict.startTime} to ${timetableConflict.endTime}`,
        conflict: true,
        timetableConflict
      });
    }

    const booking = await Booking.create({
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
      status: 'active'
    });

    const populated = await booking.populate('roomId', 'name roomNumber floor building');

    // Send confirmation email
    try {
      await sendBookingConfirmationEmail(booking);
      booking.notified = true;
      await booking.save();
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError.message);
    }

    // ---------- EMIT SOCKET EVENT ----------
    const io = getIO();
    if (io) {
      io.emit('booking-created', {
        bookingId: booking.id,
        roomId: room._id,
        roomName: room.name,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        purpose: booking.purpose,
        facultyName: booking.facultyName,
      });
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- CANCEL BOOKING (with socket emission) ----------
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('roomId', 'name');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }
    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Completed bookings cannot be cancelled' });
    }
    const bookingDate = new Date(booking.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({ success: false, message: 'Cannot cancel past bookings' });
    }
    booking.status = 'cancelled';
    await booking.save();

    // Send cancellation email
    try {
      await sendBookingCancellationEmail(booking, 'Cancelled by user');
      booking.notified = true;
      await booking.save();
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError.message);
    }

    // ---------- EMIT SOCKET EVENT ----------
    const io = getIO();
    if (io) {
      io.emit('booking-cancelled', {
        bookingId: booking.id,
        roomId: booking.roomId._id,
        roomName: booking.roomId.name,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        reason: 'Cancelled by user',
      });
    }

    res.json({ success: true, message: 'Booking cancelled', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- LOCK ROOM (unchanged) ----------
exports.lockRoom = async (req, res) => {
  try {
    const { roomId, date, startTime, endTime } = req.body;
    if (!roomId || !date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'roomId, date, startTime and endTime are required' });
    }
    const day = getDayOfWeek(date);
    const lockId = generateLockId();
    const existingLock = await Booking.findOne({
      roomId,
      date,
      startTime,
      endTime,
      lockedAt: { $exists: true, $ne: null }
    });
    if (existingLock) {
      return res.status(409).json({ success: false, message: 'Room is currently being booked by another user' });
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
      purpose: 'LOCKED',
      comment: 'Room locked for booking',
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

// ---------- UNLOCK ROOM (unchanged) ----------
exports.unlockRoom = async (req, res) => {
  try {
    const { lockId } = req.body;
    if (!lockId) return res.status(400).json({ success: false, message: 'lockId is required' });
    const booking = await Booking.findOne({ lockId });
    if (!booking) return res.status(404).json({ success: false, message: 'Lock not found' });
    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'You do not have permission to unlock this room' });
    }
    await Booking.deleteOne({ lockId });
    res.json({ success: true, message: 'Room unlocked successfully' });
  } catch (error) {
    console.error('Unlock room error:', error);
    res.status(500).json({ success: false, message: 'Failed to unlock room', error: error.message });
  }
};