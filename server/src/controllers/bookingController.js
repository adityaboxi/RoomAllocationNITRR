const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Timetable = require('../models/Timetable');
const { getDayOfWeek, isOverlapping, generateLockId } = require('../utils/helpers');

exports.bookRoom = async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, subject, comment, lockId } = req.body;

    if (!roomId || !date || !startTime || !endTime || !subject) {
      return res.status(400).json({
        success: false,
        message: 'roomId, date, startTime, endTime, subject are required'
      });
    }

    if (startTime >= endTime) {
      return res.status(400).json({
        success: false,
        message: 'End time must be after start time'
      });
    }

    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book in the past'
      });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    if (!room.isAvailable) {
      return res.status(400).json({
        success: false,
        message: 'Room is currently unavailable'
      });
    }

    if (room.department !== req.user.department) {
      return res.status(403).json({
        success: false,
        message: 'You can only book rooms from your department'
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
          message: 'You do not have permission to use this lock'
        });
      }
      await Booking.deleteOne({ lockId });
    }

    const day = getDayOfWeek(date);

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
        message: `Room is already booked for this time slot`,
        conflict: true
      });
    }

    const timetableConflict = await Timetable.findOne({
      room: roomId,
      day,
      isActive: true,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    }).populate('professor', 'name email');

    if (timetableConflict) {
      if (timetableConflict.professor._id.toString() !== req.user._id.toString()) {
        return res.status(400).json({
          success: false,
          message: `Room is scheduled for ${timetableConflict.subject} from ${timetableConflict.startTime} to ${timetableConflict.endTime}`,
          conflict: true,
          timetableConflict
        });
      }
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
    console.error('Book room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to book room',
      error: error.message
    });
  }
};

exports.getMyBookings = async (req, res) => {
  try {
    const { status, limit = 50, page = 1 } = req.query;

    const query = { professor: req.user._id };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(query)
      .populate('room')
      .populate('professor', 'name email')
      .sort({ date: -1, startTime: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
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
          conflictDetails: conflictCheck
            ? {
                subject: conflictCheck.subject,
                professor: conflictCheck.professor.name,
                time: `${conflictCheck.startTime} - ${conflictCheck.endTime}`
              }
            : null
        };
      })
    );

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      data: enrichedBookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get my bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};

exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('room')
      .populate('professor', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (
      booking.professor._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'hod'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this booking'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: error.message
    });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (
      booking.professor.toString() !== req.user._id.toString() &&
      req.user.role !== 'hod'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to cancel this booking'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    if (booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Completed bookings cannot be cancelled'
      });
    }

    booking.status = 'cancelled';
    await booking.save();

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
    });
  }
};

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
      expiresIn: '5 minutes',
      data: lock
    });
  } catch (error) {
    console.error('Lock room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lock room',
      error: error.message
    });
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
    console.error('Unlock room error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlock room',
      error: error.message
    });
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

    const availableSlots = allSlots.filter((slot) => {
      const isBooked = bookings.some((booking) =>
        isOverlapping(slot.start, slot.end, booking.startTime, booking.endTime)
      );
      const inTimetable = timetableEntries.some((timetable) =>
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
    console.error('Get available time slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch time slots',
      error: error.message
    });
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
    console.error('Get all bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
};

exports.getRoomBookings = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { startDate, endDate, limit = 50 } = req.query;

    const query = { room: roomId, status: { $in: ['active', 'completed'] } };
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
    console.error('Get room bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch room bookings',
      error: error.message
    });
  }
};
