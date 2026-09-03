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

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidTimeFormat = (time) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);

// ============================================================================
// STRICT INSTITUTIONAL TIME GRID
// ============================================================================
const VALID_TIMETABLE_SLOTS = [
  '08:10-09:00',
  '09:00-09:50',
  '09:50-10:40',
  '10:40-11:30',
  '11:30-12:20',
  '12:20-13:10',
  '13:10-14:10', // LUNCH BREAK
  '14:10-15:00',
  '15:00-15:50',
  '15:50-16:40',
  '16:40-17:30',
  '17:30-18:20'
];

// ---------- MULTER STORAGE ----------
const maxUploadBytes = (parseInt(process.env.MAX_FILE_UPLOAD_MB, 10) || 5) * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only spreadsheet files (.csv, .xlsx, .xls) are supported.'), false);
    }
  },
  limits: { fileSize: maxUploadBytes },
});

// ---------- HIGH-SPEED IN-MEMORY ROOM RESOLVER ----------
const buildDepartmentRoomMap = async (department) => {
  const rooms = await Room.find({ department, isActive: true }).lean();
  const roomMap = new Map();

  rooms.forEach((r) => {
    roomMap.set(r._id.toString(), r);
    roomMap.set(r.name.trim().toLowerCase(), r);
    roomMap.set(r.roomNumber.trim().toLowerCase(), r);
  });

  return { rooms, roomMap };
};

// ---------- HELPER: Cancel Conflicting Bookings ----------
const cancelConflictingBookings = async (timetableEntries, department) => {
  if (!timetableEntries || timetableEntries.length === 0) return [];

  const conflictConditions = timetableEntries.map((entry) => ({
    roomId: entry.roomId,
    day: entry.day,
    startTime: { $lt: entry.endTime },
    endTime: { $gt: entry.startTime },
  }));

  const activeBookings = await Booking.find({
    department,
    status: 'active',
    $or: conflictConditions,
  }).populate('roomId', 'name roomNumber building floor');

  const cancelledBookings = [];

  for (const booking of activeBookings) {
    const bookingDay = getDayOfWeek(booking.date);
    const matched = timetableEntries.find(
      (tt) =>
        tt.day === bookingDay &&
        tt.roomId.toString() === (booking.roomId?._id || booking.roomId).toString() &&
        isOverlapping(booking.startTime, booking.endTime, tt.startTime, tt.endTime)
    );

    if (matched) {
      booking.status = 'cancelled';
      booking.conflictMessage = `Room ${booking.roomId?.name || 'Room'} scheduled for class ${matched.subject} (${matched.startTime} - ${matched.endTime})`;
      await booking.save();
      cancelledBookings.push(booking);

      (async () => {
        try {
          await sendBookingCancellationEmail(booking, booking.conflictMessage);
          await Booking.findByIdAndUpdate(booking._id, { notified: true });
        } catch (emailError) {}

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
            message: `Booking cancelled: ${booking.roomId?.name || 'Room'} on ${booking.date} (${booking.startTime}-${booking.endTime}). Reason: ${booking.conflictMessage}`,
            type: 'booking-cancelled',
            metadata: {
              roomId: booking.roomId?._id || booking.roomId,
              roomName: booking.roomId?.name || 'Room',
              date: booking.date,
              startTime: booking.startTime,
              endTime: booking.endTime,
              bookingId: booking.id,
            },
          });
        }
      })().catch(() => {});
    }
  }

  return cancelledBookings;
};

// ---------- CORE REPLACEMENT & MERGE LOGIC ----------
const replaceTimetableEntries = async ({ department, semester, section, entries, userId }) => {
  const validatedEntries = [];
  const errors = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    let { day, startTime, endTime, subject, roomId, classGroup, faculty } = entry;

    const cleanSubject = subject ? String(subject).trim() : '';
    const cleanFaculty = faculty ? String(faculty).trim() : '';

    const isSubjectEmpty = cleanSubject === '';
    const isFacultyEmpty = cleanFaculty === '';

    // 1. REJECT FILE: If one is empty but the other is provided
    if (isSubjectEmpty !== isFacultyEmpty) {
      errors.push(`Row #${i + 1}: Both Subject and Faculty must be provided together, or both must be left completely empty to indicate a free slot.`);
      continue;
    }

    // 2. Format times and construct slot key
    startTime = String(startTime).trim();
    endTime = String(endTime).trim();
    const slotKey = `${startTime}-${endTime}`;

    // 3. STRICT GRID VALIDATION
    if (!VALID_TIMETABLE_SLOTS.includes(slotKey)) {
      errors.push(`Row #${i + 1}: Invalid time slot ${slotKey}. You must use the exact 50-minute institutional slots (e.g., 08:10-09:00). Do not alter the times.`);
      continue;
    }

    // 4. LUNCH BREAK ENFORCEMENT
    if (slotKey === '13:10-14:10' && (!isSubjectEmpty || !isFacultyEmpty)) {
      errors.push(`Row #${i + 1}: The 13:10-14:10 slot is reserved for the institutional break. You must leave Subject and Faculty blank.`);
      continue;
    }

    // 5. SKIP ENTRY (Free Slot or Break): If both are empty, do not add to the database
    if (isSubjectEmpty && isFacultyEmpty) {
      continue; 
    }

    if (!day || !roomId || !classGroup) {
      errors.push(`Row #${i + 1}: Day, Room, and Class Group are required`);
      continue;
    }

    validatedEntries.push({
      roomId: new mongoose.Types.ObjectId(roomId),
      day: String(day).trim(),
      startTime,
      endTime,
      subject: cleanSubject,
      classGroup: String(classGroup).trim(),
      faculty: cleanFaculty,
      semester,
      section,
      department,
      createdBy: userId,
    });
  }

  if (errors.length > 0) {
    throw new Error(`Data validation failed:\n• ${errors.slice(0, 5).join('\n• ')}`);
  }
  if (validatedEntries.length === 0) {
    throw new Error('No valid timetable entries found. (If you submitted only empty rows, the timetable remains unchanged).');
  }

  // 1. Verify all rooms belong to this department and are NOT Common / Institute Level
  const uniqueRoomIds = [...new Set(validatedEntries.map((e) => e.roomId.toString()))];
  const roomsInDb = await Room.find({ _id: { $in: uniqueRoomIds }, isActive: true }).lean();
  
  if (roomsInDb.length !== uniqueRoomIds.length) {
    throw new Error('One or more selected rooms were not found or are deactivated.');
  }

  for (const r of roomsInDb) {
    if (r.department === 'Common / Institute Level') {
      throw new Error(`🚫 Cannot schedule timetable in "${r.name}": "Common / Institute Level" rooms are strictly reserved for ad-hoc bookings only.`);
    }
    if (r.department !== department) {
      throw new Error(`🚫 Cannot schedule timetable in "${r.name}": Room belongs to "${r.department}", not "${department}".`);
    }
  }

  // 1. Intra-Batch Overlap Checks
  for (let i = 0; i < validatedEntries.length; i++) {
    for (let j = i + 1; j < validatedEntries.length; j++) {
      const a = validatedEntries[i];
      const b = validatedEntries[j];

      if (a.day === b.day && isOverlapping(a.startTime, a.endTime, b.startTime, b.endTime)) {
        if (a.roomId.toString() === b.roomId.toString()) {
          throw new Error(`🚫 Room collision in batch: Same room scheduled twice on ${a.day} (${a.startTime}-${a.endTime} & ${b.startTime}-${b.endTime})`);
        }
        if (a.faculty.toLowerCase() === b.faculty.toLowerCase()) {
          throw new Error(`🚫 Faculty collision in batch: Prof. ${a.faculty} is assigned to two overlapping classes on ${a.day} (${a.startTime}-${a.endTime} & ${b.startTime}-${b.endTime})`);
        }
      }
    }
  }

  // 2. Inter-Batch Database Checks
  for (const entry of validatedEntries) {
    const roomConflict = await Timetable.findOne({
      roomId: entry.roomId,
      day: entry.day,
      isActive: true,
      $or: [{ semester: { $ne: semester } }, { section: { $ne: section } }],
      startTime: { $lt: entry.endTime },
      endTime: { $gt: entry.startTime },
    }).populate('roomId', 'name roomNumber');

    if (roomConflict) {
      const roomName = roomConflict.roomId?.name || 'Classroom';
      const roomNum = roomConflict.roomId?.roomNumber || '';
      throw new Error(
        `🚫 Timetable Collision: Room "${roomName}" (${roomNum}) is already occupied on ${entry.day} (${roomConflict.startTime} - ${roomConflict.endTime}) by ${roomConflict.subject} for ${roomConflict.semester} Sem Sec ${roomConflict.section} (Prof. ${roomConflict.faculty}).`
      );
    }

    const facultyConflict = await Timetable.findOne({
      faculty: { $regex: new RegExp('^' + escapeRegex(entry.faculty) + '$', 'i') },
      day: entry.day,
      isActive: true,
      $or: [{ semester: { $ne: semester } }, { section: { $ne: section } }],
      startTime: { $lt: entry.endTime },
      endTime: { $gt: entry.startTime },
    });

    if (facultyConflict) {
      throw new Error(
        `🚫 Faculty Collision: Prof. ${entry.faculty} is already teaching ${facultyConflict.subject} (${facultyConflict.semester} Sem Sec ${facultyConflict.section}) on ${entry.day} (${facultyConflict.startTime}-${facultyConflict.endTime}).`
      );
    }
  }

  // 3. Deactivate old slots ONLY for the matching (department, roomId, semester, section)
  const targetRoomIds = [...new Set(validatedEntries.map((e) => e.roomId.toString()))];

  await Timetable.updateMany(
    {
      department,
      roomId: { $in: targetRoomIds },
      semester,
      section,
      isActive: true,
    },
    { $set: { isActive: false }, $inc: { version: 1 } }
  );

  const createdEntries = await Timetable.insertMany(validatedEntries);
  const cancelledBookings = await cancelConflictingBookings(createdEntries, department);

  return {
    entriesAdded: createdEntries.length,
    bookingsCancelled: cancelledBookings.length,
    entries: createdEntries,
    cancelledBookings,
  };
};

// ---------- GET TIMETABLE ----------
exports.getTimetable = async (req, res) => {
  try {
    const { department, semester, section, day, faculty, roomId } = req.query;
    const query = { isActive: true };

    if (req.user.role === 'HOD') query.department = req.user.department;
    if (department) query.department = department.trim();
    if (semester && semester !== 'ALL') query.semester = semester.trim();
    if (section && section !== 'ALL') query.section = section.trim();
    if (day && day !== 'ALL') query.day = day.trim();
    if (roomId && roomId !== 'ALL' && mongoose.Types.ObjectId.isValid(roomId)) query.roomId = roomId;
    if (faculty) query.faculty = { $regex: escapeRegex(faculty.trim()), $options: 'i' };

    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ day: 1, startTime: 1 })
      .lean();

    const formatted = entries.map((e) => ({ ...e, id: e._id.toString() }));
    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET TIMETABLE BY DEPARTMENT ----------
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET TIMETABLE BY FACULTY ----------
exports.getTimetableByFaculty = async (req, res) => {
  try {
    const { facultyName } = req.params;
    const { department } = req.query;

    const query = {
      faculty: { $regex: escapeRegex(facultyName.trim()), $options: 'i' },
      isActive: true,
    };
    if (department) query.department = department.trim();

    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ day: 1, startTime: 1 })
      .lean();

    const formatted = entries.map((e) => ({ ...e, id: e._id.toString() }));
    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET TIMETABLE BY ROOM ----------
exports.getTimetableByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { day } = req.query;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const query = { roomId, isActive: true };
    if (day) query.day = day.trim();

    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building department')
      .sort({ day: 1, startTime: 1 })
      .lean();

    const formatted = entries.map((e) => ({ ...e, id: e._id.toString() }));
    res.json({ success: true, data: formatted, total: formatted.length });
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
    if (department === 'Common / Institute Level') {
      return res.status(403).json({ success: false, message: '🚫 Timetables cannot be managed for "Common / Institute Level" rooms. These rooms are available for ad-hoc booking only.' });
    }

    const result = await replaceTimetableEntries({
      department,
      semester,
      section,
      entries,
      userId: req.user._id,
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
      message: `Timetable updated successfully! ${result.bookingsCancelled} conflicting ad-hoc bookings cancelled.`,
      data: result,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- UPDATE SINGLE ROOM DAY-WISE TIMETABLE ----------
exports.updateRoomDayTimetable = async (req, res) => {
  try {
    const { roomId, day, entries } = req.body;

    if (!roomId || !day || !Array.isArray(entries)) {
      return res.status(400).json({ success: false, message: 'roomId, day, and entries array are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const room = await Room.findById(roomId);
    if (!room || !room.isActive) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    if (room.department === 'Common / Institute Level') {
      return res.status(403).json({ success: false, message: '🚫 Timetables cannot be managed for "Common / Institute Level" rooms. These rooms are available for ad-hoc booking only.' });
    }

    if (room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'You can only update schedules for your department rooms' });
    }

    const validatedEntries = [];
    for (let idx = 0; idx < entries.length; idx++) {
      const entry = entries[idx];
      
      const cleanSubject = entry.subject ? String(entry.subject).trim() : '';
      const cleanFaculty = entry.faculty ? String(entry.faculty).trim() : '';
      const isSubjectEmpty = cleanSubject === '';
      const isFacultyEmpty = cleanFaculty === '';

      if (isSubjectEmpty !== isFacultyEmpty) {
        throw new Error(`Slot #${idx + 1}: Both Subject and Faculty must be provided together, or both must be left completely empty to indicate a free slot.`);
      }

      if (!entry.startTime || !entry.endTime) {
         throw new Error(`Slot #${idx + 1}: Start Time and End Time are required.`);
      }

      const slotKey = `${entry.startTime.trim()}-${entry.endTime.trim()}`;

      if (!VALID_TIMETABLE_SLOTS.includes(slotKey)) {
        throw new Error(`Slot #${idx + 1}: Invalid time slot ${slotKey}. You must use the exact 50-minute institutional slots.`);
      }

      if (slotKey === '13:10-14:10' && (!isSubjectEmpty || !isFacultyEmpty)) {
        throw new Error(`Slot #${idx + 1}: The 13:10-14:10 slot is reserved for the institutional break. You must leave Subject and Faculty blank.`);
      }

      if (isSubjectEmpty && isFacultyEmpty) {
        continue;
      }

      if (!entry.semester || !entry.section) {
        throw new Error(`Slot #${idx + 1}: Semester and Section are required for filled slots.`);
      }

      validatedEntries.push({
        roomId: room._id,
        day: day.trim(),
        startTime: entry.startTime.trim(),
        endTime: entry.endTime.trim(),
        subject: cleanSubject,
        classGroup: (entry.classGroup || `${entry.semester} Sec ${entry.section}`).trim(),
        faculty: cleanFaculty,
        semester: entry.semester.trim(),
        section: entry.section.trim(),
        department: room.department,
        createdBy: req.user._id,
      });
    }

    // 1. Intra-batch collision check
    for (let i = 0; i < validatedEntries.length; i++) {
      for (let j = i + 1; j < validatedEntries.length; j++) {
        const a = validatedEntries[i];
        const b = validatedEntries[j];
        if (isOverlapping(a.startTime, a.endTime, b.startTime, b.endTime)) {
          throw new Error(`🚫 Slot Collision in form: Two slots overlap on ${day} (${a.startTime}-${a.endTime} & ${b.startTime}-${b.endTime})`);
        }
      }
    }

    // 2. Inter-database collision check for other semesters/sections in the same room
    for (const entry of validatedEntries) {
      const roomConflict = await Timetable.findOne({
        roomId: room._id,
        day: day.trim(),
        isActive: true,
        $or: [{ semester: { $ne: entry.semester } }, { section: { $ne: entry.section } }],
        startTime: { $lt: entry.endTime },
        endTime: { $gt: entry.startTime },
      });

      if (roomConflict) {
        throw new Error(
          `🚫 Timetable Collision: Room "${room.name}" (${room.roomNumber}) is already occupied on ${day} from ${roomConflict.startTime} to ${roomConflict.endTime} by ${roomConflict.subject} for ${roomConflict.semester} Sem Sec ${roomConflict.section} (Prof. ${roomConflict.faculty}).`
        );
      }

      const facultyConflict = await Timetable.findOne({
        faculty: { $regex: new RegExp('^' + escapeRegex(entry.faculty) + '$', 'i') },
        day: day.trim(),
        isActive: true,
        $or: [{ semester: { $ne: entry.semester } }, { section: { $ne: entry.section } }],
        startTime: { $lt: entry.endTime },
        endTime: { $gt: entry.startTime },
      });

      if (facultyConflict) {
        throw new Error(
          `🚫 Faculty Collision: Prof. ${entry.faculty} is already teaching ${facultyConflict.subject} (${facultyConflict.semester} Sem Sec ${facultyConflict.section}) on ${day} (${facultyConflict.startTime}-${facultyConflict.endTime}).`
        );
      }
    }

    // 3. Deactivate previous slots ONLY for the matching (roomId, day, semester, section)
    const distinctPairs = [
      ...new Set(validatedEntries.map((e) => `${e.semester}__${e.section}`)),
    ];

    for (const pair of distinctPairs) {
      const [sem, sec] = pair.split('__');
      await Timetable.updateMany(
        {
          roomId: room._id,
          day: day.trim(),
          semester: sem,
          section: sec,
          isActive: true,
        },
        { $set: { isActive: false }, $inc: { version: 1 } }
      );
    }

    let created = [];
    if (validatedEntries.length > 0) {
      created = await Timetable.insertMany(validatedEntries);
      await cancelConflictingBookings(created, room.department);
    }

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', {
        department: room.department,
        roomId,
        day,
        entriesCount: created.length,
      });
    }

    res.json({
      success: true,
      message: `Schedule for ${room.name} on ${day} updated successfully (${created.length} active slots).`,
      data: created,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- FILE UPLOAD & FLEXIBLE ROOM SELECTION ----------
exports.uploadTimetableFile = upload.single('file');

exports.replaceTimetableFromFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please select a spreadsheet file (.csv, .xlsx) to upload.' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let jsonData = [];
    let detectedHeaders = [];

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
        parserStream.on('data', (record) => {
          if (records.length === 0) {
            detectedHeaders = Object.keys(record);
          }
          records.push(record);
        });
        parserStream.on('end', resolve);
        parserStream.on('error', reject);
      });
      jsonData = records;
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        return res.status(400).json({ success: false, message: 'Invalid Excel file: No worksheet found.' });
      }

      const headerRow = worksheet.getRow(1);
      headerRow.eachCell((cell, colNumber) => {
        detectedHeaders[colNumber] = cell.text.trim();
      });

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = detectedHeaders[colNumber];
          if (header) {
            rowData[header] = cell.text ? cell.text.trim() : '';
          }
        });
        jsonData.push(rowData);
      });
    }

    req.file.buffer = null;

    if (jsonData.length === 0) {
      return res.status(400).json({ success: false, message: 'The uploaded spreadsheet contains no data rows.' });
    }

    const { semester, section, roomId: explicitRoomId } = req.body;
    if (!semester || !section) {
      return res.status(400).json({ success: false, message: 'Target Semester and Section must be specified.' });
    }

    let targetRoom = null;
    if (explicitRoomId && mongoose.Types.ObjectId.isValid(explicitRoomId)) {
      targetRoom = await Room.findById(explicitRoomId);
      if (!targetRoom || !targetRoom.isActive) {
        return res.status(404).json({ success: false, message: 'Selected room not found or deactivated.' });
      }
      if (targetRoom.department === 'Common / Institute Level') {
        return res.status(403).json({ success: false, message: '🚫 Timetables cannot be managed for "Common / Institute Level" rooms. These rooms are available for ad-hoc booking only.' });
      }
      if (targetRoom.department !== req.user.department) {
        return res.status(403).json({ success: false, message: `This room belongs to "${targetRoom.department}". You can only manage rooms in your own department (${req.user.department}).` });
      }
    }

    const normalizedHeaders = detectedHeaders.map((h) => String(h || '').trim().toLowerCase().replace(/[\s_-]/g, ''));
    const requiredHeaderPatterns = [
      { key: 'day', match: ['day'] },
      { key: 'startTime', match: ['starttime', 'start'] },
      { key: 'endTime', match: ['endtime', 'end'] },
      { key: 'subject', match: ['subject', 'course', 'title'] },
      { key: 'classGroup', match: ['classgroup', 'group', 'batch'] },
      { key: 'faculty', match: ['faculty', 'professor', 'teacher', 'instructor'] },
    ];

    if (!targetRoom) {
      requiredHeaderPatterns.push({ key: 'roomId', match: ['roomid', 'room', 'roomnumber'] });
    }

    const missingHeaders = [];
    requiredHeaderPatterns.forEach((pattern) => {
      const found = pattern.match.some((alias) => normalizedHeaders.includes(alias));
      if (!found) {
        missingHeaders.push(pattern.key);
      }
    });

    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid file format. Missing required columns: [${missingHeaders.join(', ')}].`,
        requiredFormat: targetRoom
          ? 'Day, Start Time, End Time, Subject, Class Group, Faculty'
          : 'Day, Start Time, End Time, Subject, RoomId, Class Group, Faculty',
      });
    }

    const entries = jsonData.map((row) => {
      const get = (...possibleKeys) => {
        for (const k of possibleKeys) {
          const normalized = k.toLowerCase().replace(/[\s_-]/g, '');
          for (const rowKey of Object.keys(row)) {
            if (rowKey.toLowerCase().replace(/[\s_-]/g, '') === normalized) {
              return String(row[rowKey] || '').trim();
            }
          }
        }
        return '';
      };

      return {
        day: get('Day'),
        startTime: get('Start Time', 'StartTime', 'Start'),
        endTime: get('End Time', 'EndTime', 'End'),
        subject: get('Subject', 'Course'),
        roomId: targetRoom ? targetRoom._id.toString() : get('RoomId', 'Room ID', 'Room', 'RoomNumber'),
        classGroup: get('Class Group', 'ClassGroup', 'Group') || `${semester} Sec ${section}`,
        faculty: get('Faculty', 'Professor', 'Teacher'),
      };
    });

    const { roomMap } = await buildDepartmentRoomMap(req.user.department);
    const resolvedEntries = [];
    const resolveErrors = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      if (!entry.subject && !entry.faculty) {
        resolvedEntries.push(entry);
        continue;
      }

      if (targetRoom) {
        resolvedEntries.push({ ...entry, roomId: targetRoom._id });
        continue;
      }

      const searchKey = String(entry.roomId).trim().toLowerCase();
      const room = roomMap.get(searchKey);

      if (!room) {
        resolveErrors.push(`Row #${i + 1}: Room "${entry.roomId}" does not exist in ${req.user.department} catalog`);
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
        message: `Room matching failed:\n• ${resolveErrors.slice(0, 5).join('\n• ')}`,
      });
    }

    const result = await replaceTimetableEntries({
      department: req.user.department,
      semester,
      section,
      entries: resolvedEntries,
      userId: req.user._id,
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
      message: `Timetable uploaded successfully for ${targetRoom ? targetRoom.name : `${semester} Sec ${section}`}! (${result.entriesAdded} slots published, ${result.bookingsCancelled} bookings cancelled).`,
      data: result,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- UPDATE SINGLE ENTRY ----------
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

    const targetRoomId = roomId && typeof roomId === 'object' ? roomId._id || roomId.id : roomId;

    if (startTime) startTime = String(startTime).trim();
    if (endTime) endTime = String(endTime).trim();

    const checkStartTime = startTime || entry.startTime;
    const checkEndTime = endTime || entry.endTime;

    // Strict slot validation on update
    const slotKey = `${checkStartTime}-${checkEndTime}`;
    if (!VALID_TIMETABLE_SLOTS.includes(slotKey)) {
      return res.status(400).json({ success: false, message: `Invalid time slot ${slotKey}. You must use the exact 50-minute institutional slots.` });
    }

    if (slotKey === '13:10-14:10') {
      return res.status(400).json({ success: false, message: `The 13:10-14:10 slot is reserved for the institutional break and cannot be assigned a class.` });
    }

    const checkRoomId = targetRoomId || entry.roomId;
    if (!mongoose.Types.ObjectId.isValid(checkRoomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const targetRoom = await Room.findById(checkRoomId);
    if (!targetRoom || !targetRoom.isActive) {
      return res.status(404).json({ success: false, message: 'Selected room not found or deactivated' });
    }
    if (targetRoom.department === 'Common / Institute Level') {
      return res.status(403).json({ success: false, message: '🚫 Timetables cannot be assigned to "Common / Institute Level" rooms. These rooms are available for ad-hoc booking only.' });
    }
    if (targetRoom.department !== req.user.department) {
      return res.status(403).json({ success: false, message: `Room belongs to "${targetRoom.department}". You can only assign rooms from your own department (${req.user.department}).` });
    }

    const roomCollision = await Timetable.findOne({
      roomId: checkRoomId,
      day: entry.day,
      isActive: true,
      _id: { $ne: id },
      startTime: { $lt: checkEndTime },
      endTime: { $gt: checkStartTime },
    }).populate('roomId', 'name roomNumber');

    if (roomCollision) {
      const rName = roomCollision.roomId?.name || 'Classroom';
      return res.status(400).json({
        success: false,
        message: `🚫 Timetable Collision: Room "${rName}" is already occupied on ${entry.day} from ${roomCollision.startTime} to ${roomCollision.endTime} by ${roomCollision.subject} (${roomCollision.semester} Sem Sec ${roomCollision.section}, Prof. ${roomCollision.faculty}).`,
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

    await cancelConflictingBookings([entry], entry.department);

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', {
        department: entry.department,
        roomId: entry.roomId,
        day: entry.day,
        reason: 'entry-updated',
      });
    }

    const updated = await Timetable.findById(id).populate('roomId', 'name roomNumber floor building department');
    res.json({ success: true, message: 'Timetable entry updated successfully', data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ---------- DELETE SINGLE ENTRY ----------
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

    const io = getIO();
    if (io) {
      io.emit('timetable-updated', {
        department: entry.department,
        roomId: entry.roomId,
        day: entry.day,
        reason: 'entry-deleted',
      });
    }

    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};