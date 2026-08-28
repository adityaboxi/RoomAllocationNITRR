const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Timetable = require('../models/Timetable');

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ---------- GET DEPARTMENT STATS ----------
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

    const [
      totalRooms,
      availableRooms,
      activeBookings,
      todayBookings,
      totalTimetableEntries
    ] = await Promise.all([
      Room.countDocuments({ department, isActive: true }),
      Room.countDocuments({ department, isActive: true, isAvailable: true }),
      Booking.countDocuments({ department, status: 'active' }),
      Booking.countDocuments({ department, date: todayStr, status: 'active' }),
      Timetable.countDocuments({ department, isActive: true })
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