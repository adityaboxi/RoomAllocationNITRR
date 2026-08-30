const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Timetable = require('../models/Timetable');
const Holiday = require('../models/Holiday');
const { getTodayDateString, getCurrentTimeHHMM, getDayOfWeek } = require('../utils/helpers');

// ---------- GET DEPARTMENT STATS (With Real-Time Live Occupancy) ----------
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
    const currentDay = getDayOfWeek(todayStr);

    // 1. Auto-complete past active bookings
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

    // 2. Check if today is a declared department or national holiday
    const holiday = await Holiday.findOne({
      date: todayStr,
      $or: [{ department }, { department: 'ALL' }],
    });

    // 3. Find rooms currently occupied right now by active bookings or timetable classes
    const [
      totalRooms,
      bookedRoomIds,
      timetableRoomIds,
      activeBookings,
      todayBookings,
      totalTimetableEntries,
    ] = await Promise.all([
      Room.countDocuments({ department, isActive: true }),
      Booking.distinct('roomId', {
        department,
        date: todayStr,
        status: 'active',
        purpose: { $ne: 'TEMPORARY_LOCK' },
        startTime: { $lte: currentHHMM },
        endTime: { $gt: currentHHMM },
      }),
      Timetable.distinct('roomId', {
        department,
        day: currentDay,
        isActive: true,
        startTime: { $lte: currentHHMM },
        endTime: { $gt: currentHHMM },
      }),
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

    const occupiedRoomIds = new Set([
      ...bookedRoomIds.map((id) => id.toString()),
      ...timetableRoomIds.map((id) => id.toString()),
    ]);

    // If today is holiday, 0 rooms are free. Otherwise: totalRooms - occupied right now
    const availableRooms = holiday ? 0 : Math.max(0, totalRooms - occupiedRoomIds.size);

    res.json({
      success: true,
      data: {
        department,
        totalRooms,
        availableRooms, // Now reflects true real-time availability!
        occupiedRooms: occupiedRoomIds.size,
        activeBookings,
        todayBookings,
        totalTimetable: totalTimetableEntries,
        isHoliday: !!holiday,
        holidayTitle: holiday?.title || null,
      },
    });
  } catch (error) {
    // console.error('Get department stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};