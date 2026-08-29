const mongoose = require('mongoose');
const Holiday = require('../models/Holiday');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getTodayDateString } = require('../utils/helpers');
const { getIO, emitToUser } = require('../utils/socket');
const { sendBookingCancellationEmail } = require('../utils/email');

// Helper to check holiday for a specific date (handles both single date and multi-year recurring)
const findHolidayForDate = async (date, department) => {
  const monthDay = date.slice(5); // Extracts 'MM-DD'
  return await Holiday.findOne({
    $or: [{ department }, { department: 'ALL' }],
    $or: [
      { date },
      { isRecurring: true, monthDay },
    ],
  });
};

// ---------- GET HOLIDAYS ----------
exports.getHolidays = async (req, res) => {
  try {
    const { department, year } = req.query;
    const targetDept = department ? department.trim() : req.user.department;

    const query = {
      $or: [{ department: targetDept }, { department: 'ALL' }],
    };

    if (year) {
      query.$or = [
        { date: { $regex: `^${year}` } },
        { isRecurring: true }, // National recurring holidays always apply
      ];
    }

    const holidays = await Holiday.find(query).sort({ date: 1 }).lean();

    const formatted = holidays.map((h) => ({
      ...h,
      id: h._id.toString(),
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    // console.error('Get holidays error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- CREATE HOLIDAY ----------
exports.createHoliday = async (req, res) => {
  try {
    let { title, date, type, description, isInstituteWide } = req.body;

    if (!title || !date) {
      return res.status(400).json({ success: false, message: 'Title and Date are required' });
    }

    title = title.trim();
    date = date.trim();
    type = type === 'EMERGENCY' ? 'EMERGENCY' : 'NATIONAL';
    const isRecurring = type === 'NATIONAL';
    const monthDay = date.slice(5); // 'MM-DD'
    description = (description || '').trim() || (isRecurring ? 'National / Annual Holiday' : 'Emergency / Local Holiday');

    const todayStr = getTodayDateString();
    if (date < todayStr) {
      return res.status(400).json({ success: false, message: 'Cannot declare a holiday for a past date' });
    }

    const dept = isInstituteWide && req.user.role === 'SUPER_ADMIN' ? 'ALL' : req.user.department;

    // Check duplicate
    const existing = await Holiday.findOne({ department: dept, date });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A holiday ("${existing.title}") is already registered on ${date}. Use Edit/Update to modify it.`,
        existingId: existing._id,
      });
    }

    const holiday = await Holiday.create({
      title,
      date,
      monthDay,
      type,
      isRecurring,
      department: dept,
      description,
      createdBy: req.user.id || req.user._id,
      createdByName: req.user.name,
    });

    // Auto-Cancel Conflicting Bookings
    const existingBookings = await Booking.find({
      department: dept,
      date,
      status: 'active',
      purpose: { $ne: 'TEMPORARY_LOCK' },
    }).populate('roomId', 'name roomNumber');

    if (existingBookings.length > 0) {
      const cancelReason = `Cancelled: Declared ${type === 'NATIONAL' ? 'National' : 'Emergency'} Holiday (${title})`;

      await Booking.updateMany(
        { _id: { $in: existingBookings.map((b) => b._id) } },
        { $set: { status: 'cancelled', conflictMessage: cancelReason } }
      );

      for (const booking of existingBookings) {
        sendBookingCancellationEmail(booking, cancelReason).catch(() => {});

        (async () => {
          const facultyUser = await User.findOne({ email: booking.facultyEmail });
          if (facultyUser) {
            await Notification.create({
              userId: facultyUser._id,
              message: `Booking cancelled: Room "${booking.roomId?.name || 'Classroom'}" on ${booking.date} was cancelled due to ${type === 'NATIONAL' ? 'National' : 'Emergency'} Holiday: "${title}".`,
              type: 'booking-cancelled',
              metadata: {
                roomId: booking.roomId?._id || booking.roomId,
                roomName: booking.roomId?.name || 'Classroom',
                date: booking.date,
                startTime: booking.startTime,
                endTime: booking.endTime,
                bookingId: booking.id || booking._id,
                reason: cancelReason,
              },
            });

            emitToUser(facultyUser._id.toString(), 'booking-cancelled', {
              bookingId: booking.id || booking._id,
              roomName: booking.roomId?.name || 'Classroom',
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              reason: cancelReason,
            });
          }
        })().catch(() => {});
      }
    }

    await Booking.deleteMany({ department: dept, date, purpose: 'TEMPORARY_LOCK' });

    const io = getIO();
    if (io) {
      io.emit('holiday-added', {
        holidayId: holiday.id,
        title: holiday.title,
        date: holiday.date,
        type: holiday.type,
        isRecurring: holiday.isRecurring,
        department: holiday.department,
      });
    }

    res.status(201).json({
      success: true,
      message: `${type === 'NATIONAL' ? 'National (Recurring)' : 'Emergency'} Holiday "${title}" declared for ${date}. ${existingBookings.length} booking(s) cancelled.`,
      data: holiday,
    });
  } catch (error) {
    // console.error('Create holiday error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A holiday on this date already exists.' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- UPDATE HOLIDAY ----------
exports.updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    let { title, date, type, description } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid holiday ID format' });
    }

    const holiday = await Holiday.findById(id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }

    if (holiday.department !== req.user.department && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to update holidays for another department' });
    }

    if (title) holiday.title = title.trim();
    if (description !== undefined) holiday.description = description.trim();
    if (type) {
      holiday.type = type === 'EMERGENCY' ? 'EMERGENCY' : 'NATIONAL';
      holiday.isRecurring = holiday.type === 'NATIONAL';
    }

    if (date && date.trim() !== holiday.date) {
      date = date.trim();
      const todayStr = getTodayDateString();
      if (date < todayStr) {
        return res.status(400).json({ success: false, message: 'Cannot move holiday to a past date' });
      }

      // Check collision with other holidays on new date
      const collision = await Holiday.findOne({
        _id: { $ne: id },
        department: holiday.department,
        date,
      });
      if (collision) {
        return res.status(409).json({
          success: false,
          message: `Another holiday ("${collision.title}") is already on ${date}.`,
        });
      }

      holiday.date = date;
      holiday.monthDay = date.slice(5);

      // Auto-cancel bookings on new date
      const existingBookings = await Booking.find({
        department: holiday.department,
        date,
        status: 'active',
        purpose: { $ne: 'TEMPORARY_LOCK' },
      }).populate('roomId', 'name roomNumber');

      if (existingBookings.length > 0) {
        const cancelReason = `Cancelled: Holiday rescheduled to ${date} (${holiday.title})`;
        await Booking.updateMany(
          { _id: { $in: existingBookings.map((b) => b._id) } },
          { $set: { status: 'cancelled', conflictMessage: cancelReason } }
        );

        existingBookings.forEach((b) => {
          sendBookingCancellationEmail(b, cancelReason).catch(() => {});
        });
      }
    }

    await holiday.save();

    const io = getIO();
    if (io) {
      io.emit('holiday-updated', {
        holidayId: holiday.id,
        title: holiday.title,
        date: holiday.date,
        type: holiday.type,
        isRecurring: holiday.isRecurring,
        department: holiday.department,
      });
    }

    res.json({
      success: true,
      message: `Holiday "${holiday.title}" updated successfully!`,
      data: holiday,
    });
  } catch (error) {
    // console.error('Update holiday error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- DELETE HOLIDAY ----------
exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid holiday ID format' });
    }

    const holiday = await Holiday.findById(id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }

    if (holiday.department !== req.user.department && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete holidays for another department' });
    }

    await Holiday.deleteOne({ _id: id });

    const io = getIO();
    if (io) {
      io.emit('holiday-deleted', {
        holidayId: id,
        date: holiday.date,
        department: holiday.department,
      });
    }

    res.json({
      success: true,
      message: `Holiday "${holiday.title}" removed. Classrooms and timetables restored.`,
    });
  } catch (error) {
    // console.error('Delete holiday error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports.findHolidayForDate = findHolidayForDate;