const mongoose = require('mongoose');
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

// Helper to escape regex special characters (prevents ReDoS and syntax crashes)
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper to validate HH:mm format
const isValidTimeFormat = (time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

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

// ---------- HELPER: Safe Room Identifier Resolver ----------
const resolveRoomIdentifier = async (identifier, department) => {
  if (!identifier) return null;
  const cleaned = String(identifier).trim();

  // 1. Try by ObjectId
  if (mongoose.Types.ObjectId.isValid(cleaned)) {
    const room = await Room.findOne({ _id: cleaned, department, isActive: true });
    if (room) return room;
  }

  const escaped = escapeRegex(cleaned);

  // 2. Try by Name (Case-insensitive)
  let room = await Room.findOne({
    name: { $regex: new RegExp('^' + escaped + '$', 'i') },
    department,
    isActive: true
  });
  if (room) return room;

  // 3. Try by Room Number (Case-insensitive)
  room = await Room.findOne({
    roomNumber: { $regex: new RegExp('^' + escaped + '$', 'i') },
    department,
    isActive: true
  });
  if (room) return room;

  return null;
};

// ---------- HELPER: Optimized Cancellation of Conflicting Bookings ----------
const cancelConflictingBookings = async (timetableEntries, department, session = null) => {
  if (!timetableEntries || timetableEntries.length === 0) return [];

  // Build targeted $or conditions to let MongoDB filter conflicting bookings directly
  const conflictConditions = timetableEntries.map((entry) => ({
    roomId: entry.roomId,
    day: entry.day,
    startTime: { $lt: entry.endTime },
    endTime: { $gt: entry.startTime }
  }));

  const query = Booking.find({
    department,
    status: 'active',
    $or: conflictConditions
  }).populate('roomId', 'name roomNumber building floor');

  if (session) query.session(session);
  const activeBookings = await query;
  const cancelledBookings = [];

  for (const booking of activeBookings) {
    const bookingDay = getDayOfWeek(booking.date);
    const matchedTimetable = timetableEntries.find((tt) =>
      tt.day === bookingDay &&
      tt.roomId.toString() === (booking.roomId?._id || booking.roomId).toString() &&
      isOverlapping(booking.startTime, booking.endTime, tt.startTime, tt.endTime)
    );

    if (matchedTimetable) {
      booking.status = 'cancelled';
      booking.conflictMessage = `Room ${booking.roomId?.name || 'Room'} is scheduled for class ${matchedTimetable.subject} (${matchedTimetable.startTime} - ${matchedTimetable.endTime})`;
      await booking.save({ session });
      cancelledBookings.push(booking);

      // Async email & notification dispatch
      (async () => {
        try {
          await sendBookingCancellationEmail(booking, booking.conflictMessage);
          await Booking.findByIdAndUpdate(booking._id, { notified: true });
        } catch (emailError) {
          console.error('Failed to send cancellation email:', emailError.message);
        }

        const facultyUser = await User.findOne({ email: booking.facultyEmail });
        if (facultyUser) {
          emitToUser(facultyUser._id.toString(), 'booking-cancelled', {
            bookingId: booking.id,
            roomName: booking.roomId?.name || 'Room',
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            reason: booking.conflictMessage,
          });

          await Notification.create({
            userId: facultyUser._id,
            message: `Booking cancelled: ${booking.roomId?.name || 'Room'} on ${booking.date} ${booking.startTime}-${booking.endTime}. Reason: ${booking.conflictMessage}`,
            type: 'booking-cancelled',
            metadata: {
              roomId: booking.roomId?._id || booking.roomId,
              roomName: booking.roomId?.name || 'Room',
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              bookingId: booking.id,
            }
          });
        }
      })().catch(err => console.error('Notification error:', err));
    }
  }

  return cancelledBookings;
};

// ---------- HELPER: CORE REPLACEMENT LOGIC (Transactional & Multi-Section Conflict Aware) ----------
const replaceTimetableEntries = async ({ department, semester, section, entries, userId }) => {
  const validatedEntries = [];
  const errors = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let { day, startTime, endTime, subject, roomId, classGroup, faculty } = entry;

    if (!day || !startTime || !endTime || !subject || !roomId || !classGroup || !faculty) {
      errors.push(`Entry ${i + 1}: All fields are required`);
      continue;
    }

    startTime = String(startTime).trim();
    endTime = String(endTime).trim();
    day = String(day).trim();
    subject = String(subject).trim();
    classGroup = String(classGroup).trim();
    faculty = String(faculty).trim();

    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      errors.push(`Entry ${i + 1}: Times must be in HH:mm format`);
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

    const room = await Room.findById(roomId);
    if (!room || !room.isActive) {
      errors.push(`Entry ${i + 1}: Room not found or deactivated`);
      continue;
    }
    if (room.department !== department) {
      errors.push(`Entry ${i + 1}: Room ${room.name} does not belong to ${department} department`);
      continue;
    }

    validatedEntries.push({
      roomId: room._id,
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
    throw new Error('No valid timetable entries to add');
  }

  // 1. Intra-Batch Overlap Checks (Room collisions & Faculty collisions within uploaded list)
  for (let i = 0; i < validatedEntries.length; i++) {
    for (let j = i + 1; j < validatedEntries.length; j++) {
      const a = validatedEntries[i];
      const b = validatedEntries[j];

      if (a.day === b.day && isOverlapping(a.startTime, a.endTime, b.startTime, b.endTime)) {
        if (a.roomId.toString() === b.roomId.toString()) {
          throw new Error(`Room collision in uploaded entries: Room is scheduled twice on ${a.day} between ${a.startTime}-${a.endTime} and ${b.startTime}-${b.endTime}`);
        }
        if (a.faculty.toLowerCase() === b.faculty.toLowerCase()) {
          throw new Error(`Faculty collision in uploaded entries: ${a.faculty} is assigned to two classes on ${a.day} between ${a.startTime}-${a.endTime} and ${b.startTime}-${b.endTime}`);
        }
      }
    }
  }

  // 2. Inter-Batch Database Checks (Against other active semesters/sections)
  for (const entry of validatedEntries) {
    // Room conflict check against other active classes in other semesters
    const roomConflict = await Timetable.findOne({
      roomId: entry.roomId,
      day: entry.day,
      isActive: true,
      $or: [
        { semester: { $ne: semester } },
        { section: { $ne: section } }
      ],
      startTime: { $lt: entry.endTime },
      endTime: { $gt: entry.startTime }
    });
    if (roomConflict) {
      throw new Error(`Room collision with ${roomConflict.semester} Sem Sec ${roomConflict.section}: ${roomConflict.subject} at ${entry.day} ${roomConflict.startTime}-${roomConflict.endTime}`);
    }

    // Faculty conflict check against other active classes in other semesters
    const facultyConflict = await Timetable.findOne({
      faculty: { $regex: new RegExp('^' + escapeRegex(entry.faculty) + '$', 'i') },
      day: entry.day,
      isActive: true,
      $or: [
        { semester: { $ne: semester } },
        { section: { $ne: section } }
      ],
      startTime: { $lt: entry.endTime },
      endTime: { $gt: entry.startTime }
    });
    if (facultyConflict) {
      throw new Error(`Faculty clash: ${entry.faculty} is already teaching ${facultyConflict.subject} (${facultyConflict.semester} Sec ${facultyConflict.section}) on ${entry.day} ${facultyConflict.startTime}-${facultyConflict.endTime}`);
    }
  }

  // 3. Atomic Database Replacement
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Deactivate previous timetable for this semester/section
    await Timetable.updateMany(
      { department, semester, section, isActive: true },
      { $set: { isActive: false }, $inc: { version: 1 } },
      { session }
    );

    // Insert new entries
    const createdEntries = await Timetable.insertMany(validatedEntries, { session });

    // Cancel conflicting faculty bookings
    const cancelledBookings = await cancelConflictingBookings(createdEntries, department, session);

    await session.commitTransaction();

    return {
      entriesAdded: createdEntries.length,
      bookingsCancelled: cancelledBookings.length,
      entries: createdEntries,
      cancelledBookings
    };
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw err;
  } finally {
    session.endSession();
  }
};

// ---------- GET ROUTES ----------
exports.getTimetable = async (req, res) => {
  try {
    const { department, semester, section, day, faculty } = req.query;
    const query = { isActive: true };

    if (req.user.role === 'HOD') query.department = req.user.department;
    if (department) query.department = department.trim();
    if (semester) query.semester = semester.trim();
    if (section) query.section = section.trim();
    if (day) query.day = day.trim();
    if (faculty) query.faculty = { $regex: escapeRegex(faculty.trim()), $options: 'i' };

    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ day: 1, startTime: 1 })
      .lean();

    const formatted = entries.map((e) => ({ ...e, id: e._id.toString() }));
    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    console.error('Get timetable error:', error);
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

    const query = { department: department.trim(), isActive: true };
    if (semester) query.semester = semester.trim();
    if (section) query.section = section.trim();

    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ day: 1, startTime: 1 })
      .lean();

    const formatted = entries.map((e) => ({ ...e, id: e._id.toString() }));
    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    console.error('Get timetable by department error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTimetableByFaculty = async (req, res) => {
  try {
    const { facultyName } = req.params;
    const { department } = req.query;

    const query = {
      faculty: { $regex: escapeRegex(facultyName.trim()), $options: 'i' },
      isActive: true
    };
    if (department) query.department = department.trim();

    if (req.user.role === 'HOD' && department && req.user.department !== department) {
      return res.status(403).json({ success: false, message: 'You can only view your own department timetable' });
    }

    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ day: 1, startTime: 1 })
      .lean();

    const formatted = entries.map((e) => ({ ...e, id: e._id.toString() }));
    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    console.error('Get timetable by faculty error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTimetableByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const room = await Room.findById(roomId);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (req.user.role === 'HOD' && room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'You can only view your own department timetable' });
    }

    const entries = await Timetable.find({ roomId, isActive: true })
      .sort({ day: 1, startTime: 1 })
      .lean();

    const formatted = entries.map((e) => ({ ...e, id: e._id.toString() }));
    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    console.error('Get timetable by room error:', error);
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
          room: b.roomId?.name || 'Room',
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
    console.error('Replace timetable error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- FILE UPLOAD ----------
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
        headers[colNumber] = cell.text.trim();
      });
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            rowData[header] = cell.text ? cell.text.trim() : '';
          }
        });
        jsonData.push(rowData);
      });
    }

    if (jsonData.length === 0) {
      return res.status(400).json({ success: false, message: 'File is empty or could not be parsed' });
    }

    // Map columns safely (case-insensitive)
    const entries = jsonData.map(row => {
      const get = (key) => {
        return row[key] || row[key.toLowerCase()] || row[key.toUpperCase()] ||
               row[Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase())] || '';
      };
      return {
        day: get('Day'),
        startTime: get('Start Time') || get('StartTime'),
        endTime: get('End Time') || get('EndTime'),
        subject: get('Subject'),
        roomId: get('RoomId') || get('Room ID') || get('Room'),
        classGroup: get('Class Group') || get('ClassGroup'),
        faculty: get('Faculty'),
      };
    });

    const missing = entries.some(e => !e.day || !e.startTime || !e.endTime || !e.subject || !e.roomId || !e.classGroup || !e.faculty);
    if (missing) {
      return res.status(400).json({
        success: false,
        message: 'Missing required columns. Expected: Day, Start Time, End Time, Subject, RoomId, Class Group, Faculty'
      });
    }

    const { semester, section } = req.body;
    if (!semester || !section) {
      return res.status(400).json({ success: false, message: 'semester and section are required' });
    }

    // Resolve room names or room numbers to ObjectIds
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
        roomId: room._id,
      });
    }

    if (resolveErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Room resolution errors: ${resolveErrors.join('; ')}`
      });
    }

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
      message: `Timetable replaced via file. ${result.bookingsCancelled} conflicting bookings cancelled.`,
      data: {
        entriesAdded: result.entriesAdded,
        bookingsCancelled: result.bookingsCancelled,
        entries: result.entries,
        cancelledBookings: result.cancelledBookings.map(b => ({
          id: b.id,
          room: b.roomId?.name || 'Room',
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
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- UPDATE ENTRY ----------
exports.updateTimetableEntry = async (req, res) => {
  try {
    const { id } = req.params;
    let { startTime, endTime, subject, roomId, classGroup, faculty } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid timetable entry ID' });
    }

    const entry = await Timetable.findById(id);
    if (!entry || !entry.isActive) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

    if (req.user.department !== entry.department) {
      return res.status(403).json({ success: false, message: 'You can only update timetable for your own department' });
    }

    // Extract string ID if roomId was passed as an object
    const targetRoomId = roomId && typeof roomId === 'object' ? (roomId._id || roomId.id) : roomId;

    if (startTime) startTime = String(startTime).trim();
    if (endTime) endTime = String(endTime).trim();

    const checkStartTime = startTime || entry.startTime;
    const checkEndTime = endTime || entry.endTime;

    if (checkStartTime >= checkEndTime) {
      return res.status(400).json({ success: false, message: 'Start time must be before end time' });
    }

    const checkRoomId = targetRoomId || entry.roomId;

    // Check room collision with other active timetable slots
    const roomCollision = await Timetable.findOne({
      roomId: checkRoomId,
      day: entry.day,
      isActive: true,
      _id: { $ne: id },
      startTime: { $lt: checkEndTime },
      endTime: { $gt: checkStartTime }
    });

    if (roomCollision) {
      return res.status(400).json({
        success: false,
        message: `Room is already scheduled for ${roomCollision.subject} (${roomCollision.semester} Sec ${roomCollision.section}) at this time`
      });
    }

    // Check faculty collision with other active timetable slots
    const checkFaculty = faculty || entry.faculty;
    const facultyCollision = await Timetable.findOne({
      faculty: { $regex: new RegExp('^' + escapeRegex(checkFaculty.trim()) + '$', 'i') },
      day: entry.day,
      isActive: true,
      _id: { $ne: id },
      startTime: { $lt: checkEndTime },
      endTime: { $gt: checkStartTime }
    });

    if (facultyCollision) {
      return res.status(400).json({
        success: false,
        message: `Faculty ${checkFaculty} already has another class scheduled at this time`
      });
    }

    if (targetRoomId) entry.roomId = targetRoomId;
    if (startTime) entry.startTime = startTime;
    if (endTime) entry.endTime = endTime;
    if (subject) entry.subject = subject.trim();
    if (classGroup) entry.classGroup = classGroup.trim();
    if (faculty) entry.faculty = faculty.trim();

    entry.version += 1;
    await entry.save();

    // Cancel any newly conflicting faculty bookings
    await cancelConflictingBookings([entry], entry.department);

    const updated = await Timetable.findById(id).populate('roomId', 'name roomNumber floor building department');
    res.json({ success: true, message: 'Timetable entry updated successfully', data: updated });
  } catch (error) {
    console.error('Update timetable entry error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- DELETE ENTRY ----------
exports.deleteTimetableEntry = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid timetable entry ID' });
    }

    const entry = await Timetable.findById(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }

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