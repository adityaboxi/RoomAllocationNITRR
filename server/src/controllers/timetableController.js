const Timetable = require('../models/Timetable');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getDayOfWeek, isOverlapping } = require('../utils/helpers');
const { sendBookingCancellationEmail } = require('../utils/email');
const { emitToUser, getIO } = require('../utils/socket');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { parse } = require('csv-parse');
const path = require('path');
const { Readable } = require('stream');
const mongoose = require('mongoose');

// ---------- MULTER CONFIG ----------
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, .csv files are allowed'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// ---------- HELPER: Resolve room identifier to ObjectId ----------
const resolveRoomIdentifier = async (identifier, department) => {
  if (!identifier) return null;

  // If it's a valid MongoDB ObjectId, try that first
  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const room = await Room.findOne({ _id: identifier, department, isActive: true });
    if (room) return room;
  }

  // Try by name (case-insensitive)
  let room = await Room.findOne({
    name: { $regex: new RegExp('^' + identifier.trim() + '$', 'i') },
    department,
    isActive: true
  });
  if (room) return room;

  // Try by room number (case-insensitive)
  room = await Room.findOne({
    roomNumber: { $regex: new RegExp('^' + identifier.trim() + '$', 'i') },
    department,
    isActive: true
  });
  if (room) return room;

  return null;
};

// ---------- HELPER: CANCEL CONFLICTING BOOKINGS ----------
const cancelConflictingBookings = async (timetableEntries, department) => {
  const cancelledBookings = [];
  const activeBookings = await Booking.find({ department, status: 'active' }).populate('roomId');

  for (const booking of activeBookings) {
    const bookingDay = getDayOfWeek(booking.date);
    for (const timetable of timetableEntries) {
      if (
        timetable.day === bookingDay &&
        isOverlapping(booking.startTime, booking.endTime, timetable.startTime, timetable.endTime) &&
        booking.roomId._id.toString() === timetable.roomId.toString()
      ) {
        booking.status = 'cancelled';
        booking.conflictMessage =
          `Room ${booking.roomId.name} is now scheduled for ${timetable.subject} from ${timetable.startTime} to ${timetable.endTime}`;
        await booking.save();
        cancelledBookings.push(booking);

        // Send email
        try {
          await sendBookingCancellationEmail(booking, booking.conflictMessage);
          booking.notified = true;
          await booking.save();
        } catch (emailError) {
          console.error('Failed to send cancellation email:', emailError.message);
        }

        // Send socket notification
        const facultyUser = await User.findOne({ email: booking.facultyEmail });
        if (facultyUser) {
          emitToUser(facultyUser._id.toString(), 'booking-cancelled', {
            bookingId: booking.id,
            roomName: booking.roomId.name,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            reason: booking.conflictMessage,
          });

          await Notification.create({
            userId: facultyUser._id,
            message: `Booking cancelled: ${booking.roomId.name} on ${booking.date} ${booking.startTime}-${booking.endTime}. Reason: ${booking.conflictMessage}`,
            type: 'booking-cancelled',
            metadata: {
              roomId: booking.roomId._id,
              roomName: booking.roomId.name,
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              bookingId: booking.id,
            }
          });
        }
      }
    }
  }
  return cancelledBookings;
};

// ---------- HELPER: CORE REPLACEMENT LOGIC ----------
const replaceTimetableEntries = async ({ department, semester, section, entries, userId }) => {
  const validatedEntries = [];
  const errors = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const { day, startTime, endTime, subject, roomId, classGroup, faculty } = entry;
    if (!day || !startTime || !endTime || !subject || !roomId || !classGroup || !faculty) {
      errors.push(`Entry ${i + 1}: All fields are required`);
      continue;
    }
    if (startTime >= endTime) {
      errors.push(`Entry ${i + 1}: Start time must be before end time`);
      continue;
    }
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (durationMinutes < 30) {
      errors.push(`Entry ${i + 1}: Time slot must be at least 30 minutes`);
      continue;
    }

    // roomId is now an ObjectId (resolved earlier)
    const room = await Room.findById(roomId);
    if (!room) {
      errors.push(`Entry ${i + 1}: Room not found`);
      continue;
    }
    if (room.department !== department) {
      errors.push(`Entry ${i + 1}: Room ${room.name} does not belong to ${department} department`);
      continue;
    }
    validatedEntries.push({
      roomId,
      day,
      startTime,
      endTime,
      subject,
      classGroup,
      faculty,
      semester,
      section,
      department,
      createdBy: userId
    });
  }

  if (errors.length > 0) {
    throw new Error(`Validation errors: ${errors.join('; ')}`);
  }
  if (validatedEntries.length === 0) {
    throw new Error('No valid entries to add');
  }

  // Deactivate old timetable – FIXED
  await Timetable.updateMany(
    { department, semester, section, isActive: true },
    { $set: { isActive: false }, $inc: { version: 1 } }
  );

  // Check duplicate room usage & faculty conflicts
  const roomUsage = new Map();
  for (const entry of validatedEntries) {
    const key = `${entry.day}-${entry.roomId.toString()}-${entry.startTime}-${entry.endTime}`;
    if (roomUsage.has(key)) {
      const room = await Room.findById(entry.roomId);
      throw new Error(`Room ${room?.name} is already used at ${entry.day} ${entry.startTime}-${entry.endTime}`);
    }
    roomUsage.set(key, true);

    const existing = await Timetable.findOne({
      department,
      semester,
      section,
      isActive: true,
      faculty: entry.faculty,
      day: entry.day,
      startTime: { $lt: entry.endTime },
      endTime: { $gt: entry.startTime }
    });
    if (existing) {
      throw new Error(`Faculty ${entry.faculty} already has a class at ${entry.day} ${entry.startTime}-${entry.endTime}`);
    }
  }

  const createdEntries = await Timetable.insertMany(validatedEntries);

  // Cancel conflicting bookings
  const cancelledBookings = await cancelConflictingBookings(createdEntries, department);

  return {
    entriesAdded: createdEntries.length,
    bookingsCancelled: cancelledBookings.length,
    entries: createdEntries,
    cancelledBookings
  };
};

// ---------- GET ROUTES (unchanged) ----------
exports.getTimetable = async (req, res) => {
  try {
    const { department, semester, section, day, faculty } = req.query;
    const query = { isActive: true };
    if (req.user.role === 'HOD') query.department = req.user.department;
    if (department) query.department = department;
    if (semester) query.semester = semester;
    if (section) query.section = section;
    if (day) query.day = day;
    if (faculty) query.faculty = { $regex: faculty, $options: 'i' };

    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building')
      .sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTimetableByDepartment = async (req, res) => {
  try {
    const { department } = req.params;
    const { semester, section } = req.query;
    if (req.user.role === 'HOD' && req.user.department !== department) {
      return res.status(403).json({ success: false, message: 'You can only view your own department timetable' });
    }
    const query = { department, isActive: true };
    if (semester) query.semester = semester;
    if (section) query.section = section;
    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building')
      .sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTimetableByFaculty = async (req, res) => {
  try {
    const { facultyName } = req.params;
    const { department } = req.query;
    const query = { faculty: { $regex: facultyName, $options: 'i' }, isActive: true };
    if (department) query.department = department;
    if (req.user.role === 'HOD' && department && req.user.department !== department) {
      return res.status(403).json({ success: false, message: 'You can only view your own department timetable' });
    }
    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building')
      .sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTimetableByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (req.user.role === 'HOD' && room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'You can only view your own department timetable' });
    }
    const entries = await Timetable.find({ roomId, isActive: true })
      .sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- REPLACE TIMETABLE (JSON) ----------
exports.replaceTimetable = async (req, res) => {
  try {
    const { department, semester, section, entries } = req.body;
    if (!department || !semester || !section || !entries || !Array.isArray(entries)) {
      return res.status(400).json({ success: false, message: 'department, semester, section and entries array are required' });
    }
    if (req.user.department !== department) {
      return res.status(403).json({ success: false, message: `You can only manage timetable for your own department (${req.user.department})` });
    }

    const result = await replaceTimetableEntries({
      department,
      semester,
      section,
      entries,
      userId: req.user._id
    });

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', {
        department,
        semester,
        section,
        entriesAdded: result.entriesAdded,
        bookingsCancelled: result.bookingsCancelled,
      });
    }

    res.status(201).json({
      success: true,
      message: `Timetable for ${department} department updated successfully`,
      data: {
        entriesAdded: result.entriesAdded,
        bookingsCancelled: result.bookingsCancelled,
        entries: result.entries,
        cancelledBookings: result.cancelledBookings.map(b => ({
          id: b.id,
          room: b.roomId.name,
          date: b.date,
          time: `${b.startTime} - ${b.endTime}`,
          purpose: b.purpose,
          facultyName: b.facultyName,
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

// ---------- FILE UPLOAD (UPDATED to accept room names/numbers) ----------
exports.uploadTimetableFile = upload.single('file');

exports.replaceTimetableFromFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let jsonData = [];

    if (ext === '.csv') {
      const parser = parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      const records = [];
      const bufferStream = Readable.from(req.file.buffer);
      const parserStream = bufferStream.pipe(parser);
      
      await new Promise((resolve, reject) => {
        parserStream.on('data', (record) => records.push(record));
        parserStream.on('end', resolve);
        parserStream.on('error', reject);
      });
      jsonData = records;
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return res.status(400).json({ success: false, message: 'No worksheet found in the file' });
      }
      const headerRow = worksheet.getRow(1);
      const headers = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.text;
      });
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            rowData[header] = cell.text;
          }
        });
        jsonData.push(rowData);
      });
    }

    if (jsonData.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty or could not be parsed' });
    }

    // Map columns (case-insensitive)
    const entries = jsonData.map(row => {
      const get = (key) => {
        return row[key] || row[key.toLowerCase()] || row[key.toUpperCase()] ||
               row[Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase())];
      };
      return {
        day: get('Day'),
        startTime: get('Start Time') || get('StartTime'),
        endTime: get('End Time') || get('EndTime'),
        subject: get('Subject'),
        roomId: get('RoomId') || get('Room ID'),
        classGroup: get('Class Group') || get('ClassGroup'),
        faculty: get('Faculty'),
      };
    });

    // Validate required fields
    const missing = entries.some(e => !e.day || !e.startTime || !e.endTime || !e.subject || !e.roomId || !e.classGroup || !e.faculty);
    if (missing) {
      return res.status(400).json({
        success: false,
        message: 'Missing required columns. Expected: Day, Start Time, End Time, Subject, RoomId, Class Group, Faculty'
      });
    }

    // Get semester and section from body
    const { semester, section } = req.body;
    if (!semester || !section) {
      return res.status(400).json({ success: false, message: 'semester and section are required' });
    }

    // ========== NEW: Resolve each room identifier to an ObjectId ==========
    const resolvedEntries = [];
    const resolveErrors = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const room = await resolveRoomIdentifier(entry.roomId, req.user.department);
      if (!room) {
        resolveErrors.push(`Entry ${i + 1}: Room "${entry.roomId}" not found in department ${req.user.department}`);
        continue;
      }
      resolvedEntries.push({
        ...entry,
        roomId: room._id, // now an ObjectId
      });
    }

    if (resolveErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Room resolution errors: ${resolveErrors.join('; ')}`
      });
    }

    // Replace timetable using the helper with resolved ObjectIds
    const result = await replaceTimetableEntries({
      department: req.user.department,
      semester,
      section,
      entries: resolvedEntries,
      userId: req.user._id
    });

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', {
        department: req.user.department,
        semester,
        section,
        entriesAdded: result.entriesAdded,
        bookingsCancelled: result.bookingsCancelled,
      });
    }

    res.status(201).json({
      success: true,
      message: `Timetable replaced via file. ${result.bookingsCancelled} bookings cancelled.`,
      data: {
        entriesAdded: result.entriesAdded,
        bookingsCancelled: result.bookingsCancelled,
        entries: result.entries,
        cancelledBookings: result.cancelledBookings.map(b => ({
          id: b.id,
          room: b.roomId.name,
          date: b.date,
          time: `${b.startTime} - ${b.endTime}`,
          purpose: b.purpose,
          facultyName: b.facultyName,
          reason: b.conflictMessage,
          notified: b.notified
        }))
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- UPDATE & DELETE (unchanged) ----------
exports.updateTimetableEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, subject, roomId, classGroup, faculty } = req.body;

    const entry = await Timetable.findById(id);
    if (!entry) return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    if (req.user.department !== entry.department) {
      return res.status(403).json({ success: false, message: 'You can only update timetable for your own department' });
    }

    if (startTime && endTime && startTime >= endTime) {
      return res.status(400).json({ success: false, message: 'Start time must be before end time' });
    }

    if (roomId && roomId !== entry.roomId.toString()) {
      const room = await Room.findById(roomId);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
      if (room.department !== entry.department) {
        return res.status(400).json({ success: false, message: `Room ${room.name} does not belong to ${entry.department} department` });
      }
      const existingEntry = await Timetable.findOne({
        roomId,
        day: entry.day,
        isActive: true,
        startTime: { $lt: endTime || entry.endTime },
        endTime: { $gt: startTime || entry.startTime },
        _id: { $ne: id }
      });
      if (existingEntry) {
        return res.status(400).json({ success: false, message: 'Room is already booked for this time slot' });
      }
      entry.roomId = roomId;
    }

    if (startTime) entry.startTime = startTime;
    if (endTime) entry.endTime = endTime;
    if (subject) entry.subject = subject;
    if (classGroup) entry.classGroup = classGroup;
    if (faculty) entry.faculty = faculty;

    entry.version += 1;
    await entry.save();

    const updatedEntry = await Timetable.findById(id).populate('roomId');
    if (updatedEntry && updatedEntry.isActive) {
      const activeBookings = await Booking.find({
        department: updatedEntry.department,
        status: 'active'
      }).populate('roomId');
      const bookingsToCancel = [];
      for (const booking of activeBookings) {
        const bookingDay = getDayOfWeek(booking.date);
        if (
          bookingDay === updatedEntry.day &&
          booking.roomId._id.toString() === updatedEntry.roomId._id.toString() &&
          isOverlapping(booking.startTime, booking.endTime, updatedEntry.startTime, updatedEntry.endTime)
        ) {
          bookingsToCancel.push(booking);
        }
      }
      for (const booking of bookingsToCancel) {
        booking.status = 'cancelled';
        booking.conflictMessage =
          `Room ${booking.roomId.name} is now scheduled for ${updatedEntry.subject} from ${updatedEntry.startTime} to ${updatedEntry.endTime}`;
        await booking.save();

        try {
          await sendBookingCancellationEmail(booking, booking.conflictMessage);
          booking.notified = true;
          await booking.save();
        } catch (emailError) {
          console.error('Failed to send cancellation email:', emailError.message);
        }

        const facultyUser = await User.findOne({ email: booking.facultyEmail });
        if (facultyUser) {
          emitToUser(facultyUser._id.toString(), 'booking-cancelled', {
            bookingId: booking.id,
            roomName: booking.roomId.name,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            reason: booking.conflictMessage,
          });

          await Notification.create({
            userId: facultyUser._id,
            message: `Booking cancelled: ${booking.roomId.name} on ${booking.date} ${booking.startTime}-${booking.endTime}. Reason: ${booking.conflictMessage}`,
            type: 'booking-cancelled',
            metadata: {
              roomId: booking.roomId._id,
              roomName: booking.roomId.name,
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              bookingId: booking.id,
            }
          });
        }
      }
    }

    res.json({ success: true, message: 'Timetable entry updated successfully', data: entry });
  } catch (error) {
    console.error('Update timetable entry error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteTimetableEntry = async (req, res) => {
  try {
    const entry = await Timetable.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    if (req.user.department !== entry.department) {
      return res.status(403).json({ success: false, message: 'You can only delete timetable for your own department' });
    }
    entry.isActive = false;
    await entry.save();
    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (error) {
    console.error('Delete timetable entry error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};