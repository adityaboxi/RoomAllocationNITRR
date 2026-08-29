const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Timetable = require('../models/Timetable');
const { getTodayDateString, getCurrentTimeHHMM } = require('../utils/helpers');

// ---------- GET DEPARTMENT STATS (With Atomic Auto-Completion) ----------
exports.getDepartmentStats = async (req, res) => {
  try {
    let { department } = req.params;

    if (!department) {
      return res.status(400).json({ success: false, message: 'Department parameter is required' });
    }

    department = department.trim();

    if (req.user.role === 'HOD' && req.user.department !== department) {
      return res.status(403).json({
        success: false,
        message: `Not authorized to view stats for ${department}. Your assigned department is ${req.user.department}.`,
      });
    }

    const todayStr = getTodayDateString();
    const currentHHMM = getCurrentTimeHHMM();

    // 1. Auto-complete any past active bookings across the department
    await Booking.updateMany(
      {
        department,
        status: 'active',
        purpose: { $ne: 'TEMPORARY_LOCK' },
        $or: [
          { date: { $lt: todayStr } },
          { date: todayStr, endTime: { $lte: currentHHMM } },
        ],
      },
      { $set: { status: 'completed' } }
    );

    // 2. Execute parallel aggregations for true active/upcoming bookings
    const [
      totalRooms,
      availableRooms,
      activeBookings,
      todayBookings,
      totalTimetableEntries,
    ] = await Promise.all([
      Room.countDocuments({ department, isActive: true }),
      Room.countDocuments({ department, isActive: true, isAvailable: true }),
      Booking.countDocuments({
        department,
        status: 'active',
        purpose: { $ne: 'TEMPORARY_LOCK' },
        $or: [
          { date: { $gt: todayStr } },
          { date: todayStr, endTime: { $gt: currentHHMM } },
        ],
      }),
      Booking.countDocuments({
        department,
        date: todayStr,
        status: 'active',
        purpose: { $ne: 'TEMPORARY_LOCK' },
        endTime: { $gt: currentHHMM },
      }),
      Timetable.countDocuments({ department, isActive: true }),
    ]);

    res.json({
      success: true,
      data: {
        department,
        totalRooms,
        availableRooms,
        activeBookings,
        todayBookings,
        totalTimetable: totalTimetableEntries,
      },
    });
  } catch (error) {
    // console.error('Get department stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};