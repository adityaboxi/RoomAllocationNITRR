const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { getDayOfWeek, isOverlapping } = require('../utils/helpers');
const { sendBookingCancellationEmail } = require('../services/emailService');

// ============================================
// GET AVAILABLE ROOMS FOR TIMETABLE (HOD ONLY)
// ============================================
exports.getAvailableRoomsForTimetable = async (req, res) => {
  try {
    const { department, day, startTime, endTime } = req.query;

    if (!department || !day || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'department, day, startTime and endTime are required'
      });
    }

    if (req.user.department !== department) {
      return res.status(403).json({
        success: false,
        message: 'You can only manage timetable for your own department'
      });
    }

    const allRooms = await Room.find({
      department: department,
      isActive: true
    }).lean();

    const bookedRoomIds = await Timetable.distinct('room', {
      department,
      day,
      isActive: true,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });

    const bookingRoomIds = await Booking.distinct('room', {
      department,
      day,
      status: 'active'
    });

    const bookedIds = new Set([
      ...bookedRoomIds.map(id => id.toString()),
      ...bookingRoomIds.map(id => id.toString())
    ]);

    const availableRooms = allRooms.filter(
      room => !bookedIds.has(room._id.toString())
    );

    res.json({
      success: true,
      data: availableRooms,
      total: availableRooms.length,
      booked: allRooms.length - availableRooms.length
    });
  } catch (error) {
    console.error('Get available rooms error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// CREATE OR UPDATE TIMETABLE (HOD ONLY)
// ============================================
exports.createTimetable = async (req, res) => {
  try {
    const { department, semester, section, entries } = req.body;
    
    if (!department || !semester || !section || !entries || !Array.isArray(entries)) {
      return res.status(400).json({
        success: false,
        message: 'department, semester, section and entries array are required'
      });
    }

    if (req.user.department !== department) {
      return res.status(403).json({
        success: false,
        message: `You can only manage timetable for your own department (${req.user.department})`
      });
    }

    // Validate entries
    const validatedEntries = [];
    const errors = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const { day, startTime, endTime, subject, professorId, roomId } = entry;

      if (!day || !startTime || !endTime || !subject || !professorId || !roomId) {
        errors.push(`Entry ${i + 1}: All fields are required`);
        continue;
      }

      const professor = await User.findById(professorId);
      if (!professor) {
        errors.push(`Entry ${i + 1}: Professor not found`);
        continue;
      }
      if (professor.department !== department) {
        errors.push(`Entry ${i + 1}: Professor ${professor.name} does not belong to ${department} department`);
        continue;
      }

      const room = await Room.findById(roomId);
      if (!room) {
        errors.push(`Entry ${i + 1}: Room not found`);
        continue;
      }
      if (room.department !== department) {
        errors.push(`Entry ${i + 1}: Room ${room.roomNumber} does not belong to ${department} department`);
        continue;
      }

      if (startTime >= endTime) {
        errors.push(`Entry ${i + 1}: Start time must be before end time`);
        continue;
      }

      validatedEntries.push({
        department,
        semester,
        section,
        day,
        startTime,
        endTime,
        subject,
        professor: professorId,
        room: roomId,
        version: 1,
        isActive: true,
        createdBy: req.user._id
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors found',
        errors
      });
    }

    // Deactivate old timetable
    await Timetable.updateMany(
      { department, semester, section, isActive: true },
      { isActive: false, version: { $inc: 1 } }
    );

    // Check duplicate room usage
    const roomUsage = new Map();
    for (const entry of validatedEntries) {
      const key = `${entry.day}-${entry.room.toString()}-${entry.startTime}-${entry.endTime}`;
      if (roomUsage.has(key)) {
        const room = await Room.findById(entry.room);
        return res.status(400).json({
          success: false,
          message: `Room ${room.roomNumber} is already used at ${entry.day} ${entry.startTime}-${entry.endTime}`
        });
      }
      roomUsage.set(key, true);
    }

    // Save new entries
    const createdEntries = await Timetable.insertMany(validatedEntries);

    // ============================================
    // CHECK CONFLICTS WITH EXISTING BOOKINGS
    // ============================================
    const activeBookings = await Booking.find({
      department,
      status: 'active'
    }).populate('professor').populate('room');

    const cancelledBookings = [];
    const notificationsSent = [];

    for (const booking of activeBookings) {
      const bookingDay = getDayOfWeek(booking.date);
      
      for (const timetable of createdEntries) {
        if (timetable.day === bookingDay &&
            isOverlapping(booking.startTime, booking.endTime, timetable.startTime, timetable.endTime) &&
            booking.room._id.toString() === timetable.room.toString()) {
          
          // Cancel the booking
          booking.status = 'cancelled';
          booking.conflictMessage = `Room ${booking.room.roomNumber} is now scheduled for ${timetable.subject} from ${timetable.startTime} to ${timetable.endTime}`;
          await booking.save();
          cancelledBookings.push(booking);

          // Send notification email
          try {
            await sendBookingCancellationEmail(booking.professor, booking, timetable);
            booking.notified = true;
            await booking.save();
            notificationsSent.push({
              professor: booking.professor.email,
              bookingId: booking._id,
              status: 'sent'
            });
          } catch (emailError) {
            console.error('Failed to send cancellation email:', emailError);
            notificationsSent.push({
              professor: booking.professor.email,
              bookingId: booking._id,
              status: 'failed',
              error: emailError.message
            });
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Timetable for ${department} department updated successfully`,
      data: {
        entriesAdded: createdEntries.length,
        bookingsCancelled: cancelledBookings.length,
        notificationsSent: notificationsSent.length,
        entries: createdEntries.map(e => ({
          id: e._id,
          day: e.day,
          startTime: e.startTime,
          endTime: e.endTime,
          subject: e.subject,
          professor: e.professor,
          room: e.room
        })),
        cancelledBookings: cancelledBookings.map(b => ({
          id: b._id,
          room: b.room.roomNumber,
          date: b.date,
          time: `${b.startTime} - ${b.endTime}`,
          subject: b.subject,
          professor: b.professor.name,
          reason: b.conflictMessage,
          notified: b.notified
        }))
      }
    });
  } catch (error) {
    console.error('Create timetable error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// UPDATE TIMETABLE ENTRY (HOD ONLY)
// ============================================
exports.updateTimetableEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, subject, roomId } = req.body;

    const entry = await Timetable.findById(id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Timetable entry not found'
      });
    }

    if (req.user.department !== entry.department) {
      return res.status(403).json({
        success: false,
        message: `You can only update timetable for your own department`
      });
    }

    // Check if changing room
    if (roomId && roomId !== entry.room.toString()) {
      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: 'Room not found'
        });
      }
      if (room.department !== entry.department) {
        return res.status(400).json({
          success: false,
          message: `Room ${room.roomNumber} does not belong to ${entry.department} department`
        });
      }

      // Check if room is available
      const existingEntry = await Timetable.findOne({
        room: roomId,
        day: entry.day,
        isActive: true,
        startTime: { $lt: endTime || entry.endTime },
        endTime: { $gt: startTime || entry.startTime },
        _id: { $ne: id }
      });

      if (existingEntry) {
        return res.status(400).json({
          success: false,
          message: 'Room is already booked for this time slot'
        });
      }

      entry.room = roomId;
    }

    if (startTime) entry.startTime = startTime;
    if (endTime) entry.endTime = endTime;
    if (subject) entry.subject = subject;

    entry.version += 1;
    await entry.save();

    // Check for conflicts with bookings
    const conflictingBookings = await Booking.find({
      room: entry.room,
      date: { $gte: new Date() },
      status: 'active'
    }).populate('professor').populate('room');

    const cancelledBookings = [];
    const notificationsSent = [];

    for (const booking of conflictingBookings) {
      const bookingDay = getDayOfWeek(booking.date);
      
      if (bookingDay === entry.day &&
          isOverlapping(booking.startTime, booking.endTime, entry.startTime, entry.endTime)) {
        
        booking.status = 'cancelled';
        booking.conflictMessage = `Room ${booking.room.roomNumber} is now scheduled for ${entry.subject} from ${entry.startTime} to ${entry.endTime}`;
        await booking.save();
        cancelledBookings.push(booking);

        try {
          await sendBookingCancellationEmail(booking.professor, booking, entry);
          booking.notified = true;
          await booking.save();
          notificationsSent.push({
            professor: booking.professor.email,
            bookingId: booking._id,
            status: 'sent'
          });
        } catch (emailError) {
          console.error('Failed to send cancellation email:', emailError);
          notificationsSent.push({
            professor: booking.professor.email,
            bookingId: booking._id,
            status: 'failed'
          });
        }
      }
    }

    res.json({
      success: true,
      message: 'Timetable entry updated successfully',
      data: {
        entry,
        bookingsCancelled: cancelledBookings.length,
        notificationsSent: notificationsSent.length,
        cancelledBookings: cancelledBookings.map(b => ({
          id: b._id,
          room: b.room.roomNumber,
          date: b.date,
          time: `${b.startTime} - ${b.endTime}`,
          subject: b.subject,
          professor: b.professor.name,
          reason: b.conflictMessage,
          notified: b.notified
        }))
      }
    });
  } catch (error) {
    console.error('Update timetable entry error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// DELETE TIMETABLE ENTRY (HOD ONLY)
// ============================================
exports.deleteTimetableEntry = async (req, res) => {
  try {
    const entry = await Timetable.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Timetable entry not found'
      });
    }

    if (req.user.department !== entry.department) {
      return res.status(403).json({
        success: false,
        message: `You can only delete timetable for your own department`
      });
    }

    entry.isActive = false;
    await entry.save();

    res.json({
      success: true,
      message: 'Timetable entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete timetable entry error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ============================================
// GET TIMETABLE (All Users)
// ============================================
exports.getTimetable = async (req, res) => {
  try {
    const { department, semester, section, day } = req.query;
    const query = { isActive: true };
    
    if (department) query.department = department;
    if (semester) query.semester = semester;
    if (section) query.section = section;
    if (day) query.day = day;

    const timetable = await Timetable.find(query)
      .populate('professor', 'name email')
      .populate('room', 'roomNumber capacity building')
      .sort({ day: 1, startTime: 1 })
      .lean();

    const groupedByDay = timetable.reduce((acc, entry) => {
      if (!acc[entry.day]) acc[entry.day] = [];
      acc[entry.day].push(entry);
      return acc;
    }, {});

    res.json({
      success: true,
      data: groupedByDay,
      total: timetable.length
    });
  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// GET TIMETABLE BY DEPARTMENT
// ============================================
exports.getTimetableByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const { semester, section } = req.query;
    
    const query = { department, isActive: true };
    if (semester) query.semester = semester;
    if (section) query.section = section;

    const timetable = await Timetable.find(query)
      .populate('professor', 'name email')
      .populate('room', 'roomNumber capacity building')
      .sort({ semester: 1, section: 1, day: 1, startTime: 1 })
      .lean();

    res.json({
      success: true,
      data: timetable,
      total: timetable.length
    });
  } catch (error) {
    console.error('Get timetable by department error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// GET PROFESSOR TIMETABLE
// ============================================
exports.getProfessorTimetable = async (req, res) => {
  try {
    const { professorId } = req.query;
    const userId = professorId || req.user._id;

    if (professorId && req.user._id.toString() !== professorId && req.user.role !== 'hod') {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own timetable'
      });
    }

    const timetable = await Timetable.find({
      professor: userId,
      isActive: true
    })
      .populate('professor', 'name email')
      .populate('room', 'roomNumber capacity building')
      .sort({ day: 1, startTime: 1 })
      .lean();

    const groupedByDay = timetable.reduce((acc, entry) => {
      if (!acc[entry.day]) acc[entry.day] = [];
      acc[entry.day].push(entry);
      return acc;
    }, {});

    res.json({
      success: true,
      data: groupedByDay,
      total: timetable.length
    });
  } catch (error) {
    console.error('Get professor timetable error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
