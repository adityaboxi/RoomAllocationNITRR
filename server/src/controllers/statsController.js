const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Timetable = require('../models/Timetable');

exports.getDepartmentStats = async (req, res) => {
  try {
    const { department } = req.params;

    // Ensure user has access: HOD of that department or admin
    if (req.user.role === 'HOD' && req.user.department !== department) {
      return res.status(403).json({ success: false, message: 'Not authorized for this department' });
    }

    const totalRooms = await Room.countDocuments({ department, isActive: true });
    const activeBookings = await Booking.countDocuments({ department, status: 'active' });
    const totalTimetable = await Timetable.countDocuments({ department, isActive: true });

    res.json({
      success: true,
      data: {
        department,
        totalRooms,
        activeBookings,
        totalTimetable,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};