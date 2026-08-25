const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Timetable = require('../models/Timetable');
const { getDayOfWeek, isOverlapping, generateLockId } = require('../utils/helpers');

exports.lockRoom = async (req, res) => {
  try {
    const { roomId, date, startTime, endTime } = req.body;
    
    if (!roomId || !date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'roomId, date, startTime and endTime are required'
      });
    }

    const day = getDayOfWeek(date);
    const lockId = generateLockId();

    const existingLock = await Booking.findOne({
      room: roomId,
      date: new Date(date),
      startTime,
      endTime,
      lockedAt: { $exists: true, $ne: null }
    });

    if (existingLock) {
      return res.status(409).json({
        success: false,
        message: 'Room is currently being booked by another user',
        lockId: existingLock.lockId
      });
    }

    const lock = await Booking.create({
      room: roomId,
      professor: req.user._id,
      date: new Date(date),
      day,
      startTime,
      endTime,
      subject: 'LOCKED',
      comment: 'Room locked for booking',
      department: req.user.department,
      status: 'active',
      lockId,
      lockedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Room locked successfully',
      lockId,
      data: lock
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.unlockRoom = async (req, res) => {
  try {
    const { lockId } = req.body;
    
    if (!lockId) {
      return res.status(400).json({
        success: false,
        message: 'lockId is required'
      });
    }

    const booking = await Booking.findOne({ lockId });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Lock not found'
      });
    }

    if (booking.professor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to unlock this room'
      });
    }

    await Booking.deleteOne({ lockId });

    res.json({
      success: true,
      message: 'Room unlocked successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bookRoom = async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, subject, comment, lockId } = req.body;
    
    if (!roomId || !date || !startTime || !endTime || !subject) {
      return res.status(400).json({
        success: false,
        message: 'roomId, date, startTime, endTime, subject are required'
      });
    }

    if (lockId) {
      const lock = await Booking.findOne({ lockId });
      if (!lock) {
        return res.status(404).json({
          success: false,
          message: 'Invalid or expired lock. Please try again.'
        });
      }
      if (lock.professor.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to book this room'
        });
      }
      await Booking.deleteOne({ lockId });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (!room.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Room is currently unavailable'
      });
    }

    const day = getDayOfWeek(date);
    const bookingDate = new Date(date);

    const existingBooking = await Booking.findOne({
      room: roomId,
      date: bookingDate,
      status: 'active',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: 'Room is already booked for this time slot'
      });
    }

    const timetableConflict = await Timetable.findOne({
      room: roomId,
      day,
      isActive: true,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    }).populate('professor', 'name email');

    if (timetableConflict && timetableConflict.professor._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: `Room is scheduled for ${timetableConflict.subject} from ${timetableConflict.startTime} to ${timetableConflict.endTime}`,
        conflict: true
      });
    }

    const booking = await Booking.create({
      room: roomId,
      professor: req.user._id,
      date: bookingDate,
      day,
      startTime,
      endTime,
      subject,
      comment: comment || 'No comment provided',
      department: req.user.department
    });

    await booking.populate('room');
    await booking.populate('professor', 'name email');

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: booking
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ professor: req.user._id })
      .populate('room')
      .populate('professor', 'name email')
      .sort({ date: -1, startTime: -1 })
      .lean();

    const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
      const day = getDayOfWeek(booking.date);
      const conflictCheck = await Timetable.findOne({
        room: booking.room._id,
        day,
        isActive: true,
        startTime: { $lt: booking.endTime },
        endTime: { $gt: booking.startTime }
      }).populate('professor', 'name');

      return {
        ...booking,
        hasConflict: !!conflictCheck && booking.status === 'active',
        conflictDetails: conflictCheck ? {
          subject: conflictCheck.subject,
          professor: conflictCheck.professor.name,
          time: `${conflictCheck.startTime} - ${conflictCheck.endTime}`
        } : null
      };
    }));

    res.json({ success: true, data: enrichedBookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('room')
      .populate('professor', 'name email');
    
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.professor.toString() !== req.user._id.toString() && req.user.role !== 'hod') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    booking.status = 'cancelled';
    await booking.save();
    
    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const { status, department, date, limit = 50, page = 1 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (date) query.date = new Date(date);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const bookings = await Booking.find(query)
      .populate('room')
      .populate('professor', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Booking.countDocuments(query);
    res.json({
      success: true,
      data: bookings,
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

exports.getRoomBookings = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { startDate, endDate, limit = 50 } = req.query;
    
    const query = { room: roomId, status: 'active' };
    if (startDate) query.date = { $gte: new Date(startDate) };
    if (endDate) query.date = { ...query.date, $lte: new Date(endDate) };
    
    const bookings = await Booking.find(query)
      .populate('professor', 'name email')
      .sort({ date: 1, startTime: 1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json({
      success: true,
      data: bookings,
      total: bookings.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAvailableTimeSlots = async (req, res) => {
  try {
    const { roomId, date } = req.query;
    
    if (!roomId || !date) {
      return res.status(400).json({
        success: false,
        message: 'roomId and date are required'
      });
    }

    const day = getDayOfWeek(date);
    const bookingDate = new Date(date);

    const bookings = await Booking.find({
      room: roomId,
      date: bookingDate,
      status: 'active'
    }).sort({ startTime: 1 });

    const timetableEntries = await Timetable.find({
      room: roomId,
      day,
      isActive: true
    }).sort({ startTime: 1 });

    const allSlots = [];
    for (let hour = 9; hour < 17; hour++) {
      const start = `${String(hour).padStart(2, '0')}:00`;
      const end = `${String(hour + 1).padStart(2, '0')}:00`;
      allSlots.push({ start, end, label: `${start} - ${end}` });
    }

    const availableSlots = allSlots.filter(slot => {
      const isBooked = bookings.some(booking =>
        isOverlapping(slot.start, slot.end, booking.startTime, booking.endTime)
      );
      const inTimetable = timetableEntries.some(timetable =>
        isOverlapping(slot.start, slot.end, timetable.startTime, timetable.endTime)
      );
      return !isBooked && !inTimetable;
    });

    res.json({
      success: true,
      data: {
        date,
        day,
        totalSlots: allSlots.length,
        availableSlots: availableSlots.length,
        slots: availableSlots,
        bookedSlots: allSlots.length - availableSlots.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
