const Timetable = require('../models/Timetable');
const User = require('../models/User');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const { getDayOfWeek, isOverlapping } = require('../utils/helpers');

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
        message: 'You can only manage timetable for your own department'
      });
    }

    await Timetable.updateMany(
      { department, semester, section, isActive: true },
      { isActive: false, version: { $inc: 1 } }
    );

    const newEntries = [];
    const usedRooms = new Set();
    
    for (const entry of entries) {
      const { day, startTime, endTime, subject, professorId, roomId } = entry;
      
      const professor = await User.findById(professorId);
      if (!professor) {
        return res.status(404).json({
          success: false,
          message: `Professor not found: ${professorId}`
        });
      }
      
      if (professor.department !== department) {
        return res.status(400).json({
          success: false,
          message: `Professor ${professor.name} does not belong to ${department} department`
        });
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: `Room not found: ${roomId}`
        });
      }
      
      const roomKey = `${day}-${roomId}-${startTime}-${endTime}`;
      if (usedRooms.has(roomKey)) {
        return res.status(400).json({
          success: false,
          message: `Room ${room.roomNumber} is already used in this timetable`
        });
      }
      usedRooms.add(roomKey);

      newEntries.push({
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
        isActive: true
      });
    }

    await Timetable.insertMany(newEntries);

    const activeBookings = await Booking.find({
      department,
      status: 'active'
    }).populate('professor').populate('room');

    const cancelledBookings = [];
    for (const booking of activeBookings) {
      const bookingDay = getDayOfWeek(booking.date);
      
      for (const timetable of newEntries) {
        if (timetable.day === bookingDay &&
            isOverlapping(booking.startTime, booking.endTime, timetable.startTime, timetable.endTime) &&
            booking.room._id.toString() === timetable.room.toString()) {
          
          booking.status = 'cancelled';
          booking.conflictMessage = `Room ${booking.room.roomNumber} scheduled for ${timetable.subject} from ${timetable.startTime} to ${timetable.endTime}`;
          await booking.save();
          cancelledBookings.push(booking);
        }
      }
    }

    res.json({
      success: true,
      message: 'Timetable updated successfully',
      data: {
        entriesAdded: newEntries.length,
        bookingsCancelled: cancelledBookings.length,
        cancelledBookings: cancelledBookings.map(b => ({
          id: b._id,
          room: b.room.roomNumber,
          date: b.date,
          time: `${b.startTime} - ${b.endTime}`,
          subject: b.subject,
          professor: b.professor.name,
          reason: b.conflictMessage
        }))
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

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
    res.status(500).json({ success: false, message: error.message });
  }
};

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
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTimetableByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { day } = req.query;
    
    const query = { room: roomId, isActive: true };
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
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProfessorTimetable = async (req, res) => {
  try {
    const { professorId } = req.query;
    const userId = professorId || req.user._id;

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
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTimetableEntry = async (req, res) => {
  try {
    const entry = await Timetable.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    if (req.user.department !== entry.department) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete timetable entries for your own department'
      });
    }

    entry.isActive = false;
    await entry.save();

    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
